-- Snapshot referral fee at trip creation time so admin/dispatch/reporting
-- always show the amount that was in force when the trip was accepted,
-- even if the referring provider later changes their default.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS referral_fee_cents integer NOT NULL DEFAULT 0
    CHECK (referral_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS referral_fee_source_user_id uuid;

CREATE INDEX IF NOT EXISTS trips_referral_fee_source_user_id_idx
  ON public.trips(referral_fee_source_user_id);

-- Auto-snapshot: on INSERT, pull the sender's current referral fee.
CREATE OR REPLACE FUNCTION public.snapshot_trip_referral_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_type text;
  v_amt numeric;
  v_gross_cents integer;
  v_calc integer := 0;
BEGIN
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;

  SELECT referral_fee_type, referral_fee_amount
    INTO v_type, v_amt
    FROM public.member_profiles
    WHERE user_id = NEW.created_by;

  IF v_type IS NULL OR v_amt IS NULL OR v_amt <= 0 THEN
    NEW.referral_fee_cents := 0;
    NEW.referral_fee_source_user_id := NEW.created_by;
    RETURN NEW;
  END IF;

  v_gross_cents := COALESCE(ROUND(NEW.cost_total * 100)::integer, 0);

  IF v_type = 'flat' THEN
    v_calc := GREATEST(0, ROUND(v_amt * 100)::integer);
  ELSIF v_type = 'percent' THEN
    v_calc := GREATEST(0, ROUND(v_gross_cents * v_amt / 100.0)::integer);
  END IF;

  NEW.referral_fee_cents := v_calc;
  NEW.referral_fee_source_user_id := NEW.created_by;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_snapshot_trip_referral_fee ON public.trips;
CREATE TRIGGER trg_snapshot_trip_referral_fee
  BEFORE INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_trip_referral_fee();

REVOKE EXECUTE ON FUNCTION public.snapshot_trip_referral_fee() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_trip_referral_fee() TO service_role;

-- Extend the financial-field lockdown trigger to also protect the
-- snapshotted referral fee and its source. Only service_role paths may
-- change them (e.g., admin adjustment through a controlled server fn).
CREATE OR REPLACE FUNCTION public.prevent_trip_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
BEGIN
  IF v_claims IS NOT NULL THEN
    v_role := (v_claims::jsonb ->> 'role');
  END IF;

  IF v_claims IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

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
     OR NEW.payout_released_by IS DISTINCT FROM OLD.payout_released_by THEN
    RAISE EXCEPTION 'Trip financial and payout fields can only be changed by approved backend payment flows.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$fn$;

-- Trigger already exists; function replacement takes effect immediately.
REVOKE EXECUTE ON FUNCTION public.prevent_trip_financial_self_edit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_trip_financial_self_edit() TO service_role;

-- Backfill snapshots for existing trips where fee is still 0 and sender has a fee configured.
UPDATE public.trips t
SET
  referral_fee_source_user_id = COALESCE(t.referral_fee_source_user_id, t.created_by),
  referral_fee_cents = CASE
    WHEN mp.referral_fee_type = 'flat' AND mp.referral_fee_amount IS NOT NULL
      THEN GREATEST(0, ROUND(mp.referral_fee_amount * 100)::integer)
    WHEN mp.referral_fee_type = 'percent' AND mp.referral_fee_amount IS NOT NULL
      THEN GREATEST(0, ROUND(COALESCE(t.cost_total, 0) * 100 * mp.referral_fee_amount / 100.0)::integer)
    ELSE 0
  END
FROM public.member_profiles mp
WHERE mp.user_id = t.created_by
  AND t.referral_fee_cents = 0;