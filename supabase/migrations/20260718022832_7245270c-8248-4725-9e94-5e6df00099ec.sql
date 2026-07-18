
-- 1. New columns on trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS payer_kind text,
  ADD COLUMN IF NOT EXISTS payer_user_id uuid,
  ADD COLUMN IF NOT EXISTS payment_source text,
  ADD COLUMN IF NOT EXISTS financial_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS medicaid_remit_received_at timestamptz;

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_payer_kind_check;
ALTER TABLE public.trips
  ADD CONSTRAINT trips_payer_kind_check CHECK (
    payer_kind IS NULL OR payer_kind IN
    ('patient','facility','broker','workers_comp','medicaid','provider_referral','provider_self')
  );

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_payment_source_check;
ALTER TABLE public.trips
  ADD CONSTRAINT trips_payment_source_check CHECK (
    payment_source IS NULL OR payment_source IN
    ('stripe_card','stripe_ach','medicaid_claim','broker_invoice','manual')
  );

-- 2. Expand payment_status vocabulary + backfill
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_payment_status_check;

UPDATE public.trips SET payment_status = 'pending_invoice' WHERE payment_status = 'unpaid';
UPDATE public.trips SET payment_status = 'invoiced' WHERE payment_status = 'authorized';

ALTER TABLE public.trips ALTER COLUMN payment_status SET DEFAULT 'pending_invoice';
ALTER TABLE public.trips ADD CONSTRAINT trips_payment_status_check CHECK (
  payment_status IN ('pending_invoice','invoiced','paid','validated','refunded','failed')
);

-- 3. Extend financial-lockdown trigger to cover new columns + post-release lock
CREATE OR REPLACE FUNCTION public.prevent_trip_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
  v_is_admin boolean := false;
BEGIN
  IF v_claims IS NOT NULL THEN
    v_role := (v_claims::jsonb ->> 'role');
  END IF;

  -- Post-release lock: once released, only service_role may touch financials
  IF OLD.financial_locked_at IS NOT NULL AND (v_claims IS NULL OR v_role = 'service_role') THEN
    -- service_role bypass
    RETURN NEW;
  END IF;

  IF OLD.financial_locked_at IS NOT NULL THEN
    IF NEW.cost_total IS DISTINCT FROM OLD.cost_total
       OR NEW.provider_payout_cents IS DISTINCT FROM OLD.provider_payout_cents
       OR NEW.platform_fee_cents IS DISTINCT FROM OLD.platform_fee_cents
       OR NEW.referral_fee_cents IS DISTINCT FROM OLD.referral_fee_cents
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.payout_status IS DISTINCT FROM OLD.payout_status THEN
      RAISE EXCEPTION 'Trip financials are locked after payout release.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF v_claims IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_is_admin := auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role);

  IF NEW.cost_total IS DISTINCT FROM OLD.cost_total
     OR NEW.cost_breakdown IS DISTINCT FROM OLD.cost_breakdown
     OR NEW.estimated_cost_cents IS DISTINCT FROM OLD.estimated_cost_cents
     OR NEW.provider_payout_cents IS DISTINCT FROM OLD.provider_payout_cents
     OR NEW.platform_fee_cents IS DISTINCT FROM OLD.platform_fee_cents
     OR NEW.referral_fee_cents IS DISTINCT FROM OLD.referral_fee_cents
     OR NEW.referral_fee_source_user_id IS DISTINCT FROM OLD.referral_fee_source_user_id
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.payout_status IS DISTINCT FROM OLD.payout_status
     OR NEW.payout_released_at IS DISTINCT FROM OLD.payout_released_at
     OR NEW.payout_transfer_id IS DISTINCT FROM OLD.payout_transfer_id
     OR NEW.payout_eligible_at IS DISTINCT FROM OLD.payout_eligible_at
     OR NEW.payout_hold_reasons IS DISTINCT FROM OLD.payout_hold_reasons
     OR NEW.payout_is_medicaid IS DISTINCT FROM OLD.payout_is_medicaid
     OR NEW.payout_validated_at IS DISTINCT FROM OLD.payout_validated_at
     OR NEW.payout_validated_by IS DISTINCT FROM OLD.payout_validated_by
     OR NEW.payout_released_by IS DISTINCT FROM OLD.payout_released_by
     OR NEW.payer_kind IS DISTINCT FROM OLD.payer_kind
     OR NEW.payer_user_id IS DISTINCT FROM OLD.payer_user_id
     OR NEW.payment_source IS DISTINCT FROM OLD.payment_source
     OR NEW.financial_locked_at IS DISTINCT FROM OLD.financial_locked_at
     OR NEW.medicaid_remit_received_at IS DISTINCT FROM OLD.medicaid_remit_received_at THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Trip financial and payout fields can only be changed by approved backend payment flows.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Auto-lock financials once payout is released
CREATE OR REPLACE FUNCTION public.lock_trip_financials_after_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payout_status = 'released'
     AND OLD.payout_status IS DISTINCT FROM 'released'
     AND NEW.financial_locked_at IS NULL THEN
    NEW.financial_locked_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_lock_trip_financials_after_release ON public.trips;
CREATE TRIGGER trg_lock_trip_financials_after_release
  BEFORE UPDATE OF payout_status ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.lock_trip_financials_after_release();

-- 5. Admin-only financial ledger view
DROP VIEW IF EXISTS public.trip_financial_ledger;
CREATE VIEW public.trip_financial_ledger
WITH (security_invoker = true)
AS
SELECT
  t.id AS trip_id,
  t.display_id,
  t.payer_kind,
  COALESCE(t.payer, t.payer_kind) AS payer_label,
  t.payment_source,
  COALESCE(ROUND(t.cost_total * 100)::int, 0) AS gross_cents,
  COALESCE(t.platform_fee_cents, 0) AS platform_fee_cents,
  COALESCE(t.referral_fee_cents, 0) AS referral_fee_cents,
  COALESCE(t.provider_payout_cents, 0) AS provider_payout_cents,
  t.payment_status,
  t.payout_status,
  t.payout_hold_reasons,
  t.payout_is_medicaid,
  t.medicaid_remit_received_at,
  t.assigned_to AS provider_user_id,
  mp.company_name AS provider_name,
  t.referral_fee_source_user_id,
  mp2.company_name AS referral_source_name,
  t.completed_at,
  t.payout_eligible_at,
  t.payout_released_at,
  t.financial_locked_at,
  t.created_at
FROM public.trips t
LEFT JOIN public.member_profiles mp ON mp.user_id = t.assigned_to
LEFT JOIN public.member_profiles mp2 ON mp2.user_id = t.referral_fee_source_user_id
WHERE public.is_ops_staff(auth.uid());

GRANT SELECT ON public.trip_financial_ledger TO authenticated;
GRANT ALL ON public.trip_financial_ledger TO service_role;
