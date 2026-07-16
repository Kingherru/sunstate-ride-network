
-- 1. Payout hold + validation columns on trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS payout_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_hold_reasons text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS payout_is_medicaid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_validated_by uuid,
  ADD COLUMN IF NOT EXISTS payout_released_by uuid;

CREATE INDEX IF NOT EXISTS trips_payout_eligible_idx ON public.trips (payout_eligible_at) WHERE payout_status IN ('pending','held');

-- 2. Guard financial/payout columns from provider self-edit
CREATE OR REPLACE FUNCTION public.prevent_trip_financial_self_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
BEGIN
  IF v_claims IS NOT NULL THEN v_role := (v_claims::jsonb ->> 'role'); END IF;
  -- Backend / service_role bypass
  IF v_claims IS NULL OR v_role = 'service_role' THEN RETURN NEW; END IF;
  -- Admins may adjust everything
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;

  -- Everyone else: revert financial + payout columns
  NEW.cost_total               := OLD.cost_total;
  NEW.provider_payout_cents    := OLD.provider_payout_cents;
  NEW.platform_fee_cents       := OLD.platform_fee_cents;
  NEW.payout_status            := OLD.payout_status;
  NEW.payout_released_at       := OLD.payout_released_at;
  NEW.payout_transfer_id       := OLD.payout_transfer_id;
  NEW.payout_eligible_at       := OLD.payout_eligible_at;
  NEW.payout_hold_reasons      := OLD.payout_hold_reasons;
  NEW.payout_is_medicaid       := OLD.payout_is_medicaid;
  NEW.payout_validated_at      := OLD.payout_validated_at;
  NEW.payout_validated_by      := OLD.payout_validated_by;
  NEW.payout_released_by       := OLD.payout_released_by;
  NEW.payment_status           := OLD.payment_status;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_prevent_trip_financial_self_edit ON public.trips;
CREATE TRIGGER trg_prevent_trip_financial_self_edit
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.prevent_trip_financial_self_edit();

-- 3. Guard provider_payout_transfers — only service_role/admin may write
CREATE OR REPLACE FUNCTION public.prevent_payout_transfer_client_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
BEGIN
  IF v_claims IS NOT NULL THEN v_role := (v_claims::jsonb ->> 'role'); END IF;
  IF v_claims IS NULL OR v_role = 'service_role' THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Provider payout transfers can only be written by the payout service.'
    USING ERRCODE = 'insufficient_privilege';
END $fn$;

DROP TRIGGER IF EXISTS trg_prevent_payout_transfer_client_write ON public.provider_payout_transfers;
CREATE TRIGGER trg_prevent_payout_transfer_client_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.provider_payout_transfers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_payout_transfer_client_write();
