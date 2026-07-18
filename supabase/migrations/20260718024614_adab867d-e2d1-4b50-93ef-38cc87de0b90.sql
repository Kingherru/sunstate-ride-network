
-- ============================================================
-- PART 1: TEARDOWN — disable old triggers & rename legacy stuff
-- ============================================================

-- Drop old finance triggers on trips
DROP TRIGGER IF EXISTS trg_snapshot_trip_referral_fee ON public.trips;
DROP TRIGGER IF EXISTS trg_lock_trip_financials_after_release ON public.trips;
DROP TRIGGER IF EXISTS trg_prevent_trip_financial_self_edit ON public.trips;
DROP TRIGGER IF EXISTS trg_trips_payment_notify ON public.trips;

-- Drop old finance functions (safe if referenced only by dropped triggers)
DROP FUNCTION IF EXISTS public.snapshot_trip_referral_fee() CASCADE;
DROP FUNCTION IF EXISTS public.lock_trip_financials_after_release() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_trip_financial_self_edit() CASCADE;
DROP FUNCTION IF EXISTS public.set_trip_payment_status(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.attempt_trip_payout_release(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.validate_trip_payment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.mark_trip_medicaid_remit_received(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.admin_release_trip_payout(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.list_trip_financial_ledger() CASCADE;
DROP VIEW IF EXISTS public.trip_financial_ledger CASCADE;

-- Rename legacy trips columns (data preserved, code will fail loudly)
DO $$
DECLARE
  cols text[] := ARRAY[
    'cost_total','cost_breakdown','estimated_cost_cents',
    'provider_payout_cents','platform_fee_cents','referral_fee_cents','referral_fee_source_user_id',
    'payment_status','payout_status','payout_eligible_at','payout_released_at','payout_released_by',
    'payout_hold_reasons','payout_is_medicaid','payout_validated_at','payout_validated_by',
    'payout_transfer_id','payer_kind','payer_user_id','payment_source',
    'financial_locked_at','medicaid_remit_received_at'
  ];
  c text;
BEGIN
  FOREACH c IN ARRAY cols LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='trips' AND column_name=c) THEN
      EXECUTE format('ALTER TABLE public.trips RENAME COLUMN %I TO %I', c, '_legacy_'||c);
    END IF;
  END LOOP;
END $$;

-- Rename legacy tables
ALTER TABLE IF EXISTS public.trip_payments RENAME TO _legacy_trip_payments;
ALTER TABLE IF EXISTS public.trip_quotes RENAME TO _legacy_trip_quotes;
ALTER TABLE IF EXISTS public.provider_payout_transfers RENAME TO _legacy_provider_payout_transfers;

-- Revoke all client access to legacy tables
REVOKE ALL ON public._legacy_trip_payments FROM anon, authenticated;
REVOKE ALL ON public._legacy_trip_quotes FROM anon, authenticated;
REVOKE ALL ON public._legacy_provider_payout_transfers FROM anon, authenticated;

-- ============================================================
-- PART 2: NEW SCHEMA
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.fin_payment_state AS ENUM ('none','invoiced','paid','validated','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_payout_state AS ENUM ('none','holding','releasable','paid_out','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_payer_kind AS ENUM ('patient','facility','broker','workers_comp','medicaid','provider_self');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_charge_status AS ENUM ('pending','succeeded','failed','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_payout_status AS ENUM ('pending','released','failed','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add new columns to trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS fin_gross_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fin_platform_fee_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fin_platform_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fin_referral_fee_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fin_referral_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fin_provider_net_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fin_payer_kind public.fin_payer_kind,
  ADD COLUMN IF NOT EXISTS fin_payer_user_id uuid,
  ADD COLUMN IF NOT EXISTS fin_payment_source text,
  ADD COLUMN IF NOT EXISTS fin_payment_state public.fin_payment_state NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS fin_payout_state public.fin_payout_state NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS fin_is_medicaid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fin_medicaid_funds_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS fin_payout_hold_until timestamptz,
  ADD COLUMN IF NOT EXISTS fin_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fin_locked_at timestamptz;

-- Platform-wide settings (single row)
CREATE TABLE IF NOT EXISTS public.fin_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  platform_fee_bps integer NOT NULL DEFAULT 200, -- 2%
  standard_hold_hours integer NOT NULL DEFAULT 48,
  medicaid_hold_days integer NOT NULL DEFAULT 15,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.fin_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.fin_settings TO authenticated;
GRANT ALL ON public.fin_settings TO service_role;
ALTER TABLE public.fin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_settings readable" ON public.fin_settings FOR SELECT TO authenticated USING (true);

-- Charges (inbound)
CREATE TABLE IF NOT EXISTS public.fin_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  payer_user_id uuid,
  payer_kind public.fin_payer_kind NOT NULL,
  payment_source text NOT NULL,
  external_ref text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status public.fin_charge_status NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_charges_trip_idx ON public.fin_charges(trip_id);
CREATE INDEX IF NOT EXISTS fin_charges_payer_idx ON public.fin_charges(payer_user_id);

GRANT SELECT ON public.fin_charges TO authenticated;
GRANT ALL ON public.fin_charges TO service_role;
ALTER TABLE public.fin_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_charges: payer or trip party can read"
  ON public.fin_charges FOR SELECT TO authenticated
  USING (
    payer_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid()))
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.is_ops_staff(auth.uid())
  );

-- Payouts (outbound)
CREATE TABLE IF NOT EXISTS public.fin_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  provider_user_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status public.fin_payout_status NOT NULL DEFAULT 'pending',
  transfer_ref text,
  released_at timestamptz,
  released_by uuid,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_payouts_trip_idx ON public.fin_payouts(trip_id);
CREATE INDEX IF NOT EXISTS fin_payouts_provider_idx ON public.fin_payouts(provider_user_id);

GRANT SELECT ON public.fin_payouts TO authenticated;
GRANT ALL ON public.fin_payouts TO service_role;
ALTER TABLE public.fin_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_payouts: provider or admin can read"
  ON public.fin_payouts FOR SELECT TO authenticated
  USING (
    provider_user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.is_ops_staff(auth.uid())
  );

-- updated_at triggers
CREATE TRIGGER fin_charges_updated_at BEFORE UPDATE ON public.fin_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER fin_payouts_updated_at BEFORE UPDATE ON public.fin_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER fin_settings_updated_at BEFORE UPDATE ON public.fin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 3: TRIP-LEVEL LOCKDOWN
-- ============================================================

-- Revoke direct UPDATE of new financial columns for clients.
-- Postgres GRANT is per-column: we grant UPDATE on the safe columns instead.
-- Simpler approach: trigger that blocks non-service_role from touching fin_* columns.
CREATE OR REPLACE FUNCTION public.fin_block_direct_trip_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
BEGIN
  IF v_claims IS NOT NULL THEN v_role := (v_claims::jsonb ->> 'role'); END IF;
  -- service_role bypass
  IF v_claims IS NULL OR v_role = 'service_role' THEN
    -- also enforce lock after paid_out
    IF OLD.fin_locked_at IS NOT NULL AND (
      NEW.fin_gross_cents IS DISTINCT FROM OLD.fin_gross_cents
      OR NEW.fin_platform_fee_cents IS DISTINCT FROM OLD.fin_platform_fee_cents
      OR NEW.fin_referral_fee_cents IS DISTINCT FROM OLD.fin_referral_fee_cents
      OR NEW.fin_provider_net_cents IS DISTINCT FROM OLD.fin_provider_net_cents
    ) THEN
      -- allow state-only updates post-lock (e.g. refunded), block amount changes
      RAISE EXCEPTION 'Trip finance amounts are locked after payout.';
    END IF;
    RETURN NEW;
  END IF;

  -- Any authenticated user: forbid editing fin_* columns entirely.
  IF NEW.fin_gross_cents IS DISTINCT FROM OLD.fin_gross_cents
     OR NEW.fin_platform_fee_bps IS DISTINCT FROM OLD.fin_platform_fee_bps
     OR NEW.fin_platform_fee_cents IS DISTINCT FROM OLD.fin_platform_fee_cents
     OR NEW.fin_referral_fee_bps IS DISTINCT FROM OLD.fin_referral_fee_bps
     OR NEW.fin_referral_fee_cents IS DISTINCT FROM OLD.fin_referral_fee_cents
     OR NEW.fin_provider_net_cents IS DISTINCT FROM OLD.fin_provider_net_cents
     OR NEW.fin_payer_kind IS DISTINCT FROM OLD.fin_payer_kind
     OR NEW.fin_payer_user_id IS DISTINCT FROM OLD.fin_payer_user_id
     OR NEW.fin_payment_source IS DISTINCT FROM OLD.fin_payment_source
     OR NEW.fin_payment_state IS DISTINCT FROM OLD.fin_payment_state
     OR NEW.fin_payout_state IS DISTINCT FROM OLD.fin_payout_state
     OR NEW.fin_is_medicaid IS DISTINCT FROM OLD.fin_is_medicaid
     OR NEW.fin_medicaid_funds_received_at IS DISTINCT FROM OLD.fin_medicaid_funds_received_at
     OR NEW.fin_payout_hold_until IS DISTINCT FROM OLD.fin_payout_hold_until
     OR NEW.fin_completed_at IS DISTINCT FROM OLD.fin_completed_at
     OR NEW.fin_locked_at IS DISTINCT FROM OLD.fin_locked_at THEN
    RAISE EXCEPTION 'Trip finance fields can only be changed by the payment service.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_fin_block_direct_trip_writes
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.fin_block_direct_trip_writes();

-- Snapshot on insert
CREATE OR REPLACE FUNCTION public.fin_snapshot_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_settings public.fin_settings;
  v_ref_bps int := 0;
  v_ref_type text;
  v_ref_amt numeric;
BEGIN
  SELECT * INTO v_settings FROM public.fin_settings WHERE id = true;
  NEW.fin_platform_fee_bps := COALESCE(v_settings.platform_fee_bps, 200);

  -- referral fee snapshot from sender profile
  IF NEW.created_by IS NOT NULL THEN
    SELECT referral_fee_type, referral_fee_amount
      INTO v_ref_type, v_ref_amt
      FROM public.member_profiles
     WHERE user_id = NEW.created_by;
    IF v_ref_type = 'percent' AND v_ref_amt IS NOT NULL AND v_ref_amt > 0 THEN
      v_ref_bps := GREATEST(0, ROUND(v_ref_amt * 100)::int);
    END IF;
    -- flat referral fee is captured as cents later during finalize; skip bps here
  END IF;
  NEW.fin_referral_fee_bps := v_ref_bps;

  -- default states
  NEW.fin_payment_state := COALESCE(NEW.fin_payment_state, 'none');
  NEW.fin_payout_state  := COALESCE(NEW.fin_payout_state, 'none');
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_fin_snapshot_on_create
  BEFORE INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.fin_snapshot_on_create();

-- ============================================================
-- PART 4: SERVICE FUNCTIONS (called by server code only)
-- ============================================================

-- Set/update the gross amount and recompute fees (admin/service only).
CREATE OR REPLACE FUNCTION public.fin_set_amounts(
  _trip_id uuid,
  _gross_cents integer,
  _referral_flat_cents integer DEFAULT 0,
  _payer_kind public.fin_payer_kind DEFAULT NULL,
  _payer_user_id uuid DEFAULT NULL,
  _payment_source text DEFAULT NULL,
  _is_medicaid boolean DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  t public.trips;
  v_plat int;
  v_ref int;
  v_net int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR current_setting('request.jwt.claims',true) IS NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.fin_locked_at IS NOT NULL THEN RAISE EXCEPTION 'Trip finance is locked'; END IF;

  v_plat := GREATEST(0, ROUND(_gross_cents * t.fin_platform_fee_bps / 10000.0)::int);
  v_ref  := GREATEST(0, ROUND(_gross_cents * t.fin_referral_fee_bps / 10000.0)::int) + COALESCE(_referral_flat_cents,0);
  v_net  := GREATEST(0, _gross_cents - v_plat - v_ref);

  UPDATE public.trips SET
    fin_gross_cents = _gross_cents,
    fin_platform_fee_cents = v_plat,
    fin_referral_fee_cents = v_ref,
    fin_provider_net_cents = v_net,
    fin_payer_kind = COALESCE(_payer_kind, fin_payer_kind),
    fin_payer_user_id = COALESCE(_payer_user_id, fin_payer_user_id),
    fin_payment_source = COALESCE(_payment_source, fin_payment_source),
    fin_is_medicaid = COALESCE(_is_medicaid, fin_is_medicaid)
  WHERE id = _trip_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fin_set_amounts(uuid,integer,integer,public.fin_payer_kind,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_set_amounts(uuid,integer,integer,public.fin_payer_kind,uuid,text,boolean) TO service_role;

-- Mark trip paid (creates/updates a fin_charges row + moves payment_state)
CREATE OR REPLACE FUNCTION public.fin_mark_paid(
  _trip_id uuid, _amount_cents integer, _source text, _external_ref text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_charge_id uuid; t public.trips;
BEGIN
  SELECT * INTO t FROM public.trips WHERE id = _trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;

  INSERT INTO public.fin_charges (trip_id, payer_user_id, payer_kind, payment_source, external_ref, amount_cents, status, processed_at)
    VALUES (_trip_id, t.fin_payer_user_id, COALESCE(t.fin_payer_kind,'patient'::public.fin_payer_kind),
            _source, _external_ref, _amount_cents, 'succeeded', now())
  RETURNING id INTO v_charge_id;

  UPDATE public.trips SET fin_payment_state = 'paid' WHERE id = _trip_id;
  RETURN v_charge_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fin_mark_paid(uuid,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_mark_paid(uuid,integer,text,text) TO service_role;

-- Validate payment (admin) — moves state to validated and starts the hold clock
CREATE OR REPLACE FUNCTION public.fin_validate_payment(_trip_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE t public.trips; v_settings public.fin_settings; v_hold timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.is_ops_staff(auth.uid()) OR current_setting('request.jwt.claims',true) IS NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.fin_payment_state NOT IN ('paid','validated') THEN RAISE EXCEPTION 'Payment not received yet'; END IF;

  SELECT * INTO v_settings FROM public.fin_settings WHERE id = true;

  IF t.fin_is_medicaid THEN
    v_hold := COALESCE(t.fin_medicaid_funds_received_at, now()) + make_interval(days => v_settings.medicaid_hold_days);
  ELSE
    v_hold := COALESCE(t.fin_completed_at, now()) + make_interval(hours => v_settings.standard_hold_hours);
  END IF;

  UPDATE public.trips SET
    fin_payment_state = 'validated',
    fin_payout_state = CASE WHEN fin_payout_state = 'none' THEN 'holding'::public.fin_payout_state ELSE fin_payout_state END,
    fin_payout_hold_until = v_hold
  WHERE id = _trip_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fin_validate_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_validate_payment(uuid) TO authenticated, service_role;

-- Release payout (service or admin) — creates fin_payouts row, flips states
CREATE OR REPLACE FUNCTION public.fin_release_payout(_trip_id uuid, _transfer_ref text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE t public.trips; v_payout_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR current_setting('request.jwt.claims',true) IS NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.fin_payment_state <> 'validated' THEN RAISE EXCEPTION 'Payment not validated'; END IF;
  IF t.fin_payout_state = 'paid_out' THEN RAISE EXCEPTION 'Already paid out'; END IF;
  IF t.assigned_to IS NULL THEN RAISE EXCEPTION 'No provider assigned'; END IF;
  IF t.fin_payout_hold_until IS NOT NULL AND t.fin_payout_hold_until > now() THEN
    RAISE EXCEPTION 'Hold period has not expired';
  END IF;

  INSERT INTO public.fin_payouts (trip_id, provider_user_id, amount_cents, status, transfer_ref, released_at, released_by)
    VALUES (_trip_id, t.assigned_to, t.fin_provider_net_cents, 'released', _transfer_ref, now(), auth.uid())
  RETURNING id INTO v_payout_id;

  UPDATE public.trips SET
    fin_payout_state = 'paid_out',
    fin_locked_at = now()
  WHERE id = _trip_id;

  RETURN v_payout_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fin_release_payout(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_release_payout(uuid,text) TO service_role;

-- Refund
CREATE OR REPLACE FUNCTION public.fin_refund(_trip_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR current_setting('request.jwt.claims',true) IS NULL) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.fin_charges SET status = 'refunded', metadata = metadata || jsonb_build_object('refund_reason', COALESCE(_reason,''))
    WHERE trip_id = _trip_id AND status = 'succeeded';
  UPDATE public.trips SET fin_payment_state = 'refunded', fin_payout_state = 'cancelled' WHERE id = _trip_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fin_refund(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_refund(uuid,text) TO authenticated, service_role;

-- Public readers
CREATE OR REPLACE FUNCTION public.fin_get_settings()
RETURNS TABLE(platform_fee_bps int, standard_hold_hours int, medicaid_hold_days int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT platform_fee_bps, standard_hold_hours, medicaid_hold_days FROM public.fin_settings WHERE id = true $$;

GRANT EXECUTE ON FUNCTION public.fin_get_settings() TO authenticated, anon;

-- Admin ledger view
CREATE OR REPLACE VIEW public.admin_fin_ledger
WITH (security_invoker = true) AS
SELECT
  t.id AS trip_id, t.display_id, t.status AS trip_status,
  t.created_by, t.assigned_to,
  t.fin_payer_kind, t.fin_payer_user_id, t.fin_payment_source,
  t.fin_gross_cents, t.fin_platform_fee_cents, t.fin_referral_fee_cents, t.fin_provider_net_cents,
  t.fin_payment_state, t.fin_payout_state,
  t.fin_is_medicaid, t.fin_medicaid_funds_received_at,
  t.fin_payout_hold_until, t.fin_completed_at, t.fin_locked_at,
  t.created_at, t.pickup_date
FROM public.trips t
WHERE public.has_role(auth.uid(),'admin'::app_role) OR public.is_ops_staff(auth.uid());

GRANT SELECT ON public.admin_fin_ledger TO authenticated;
