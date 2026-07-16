-- Permanently restrict direct client edits to trip financial/payout fields.

-- 1) Replace broad participant update policy with narrower row rules.
DROP POLICY IF EXISTS "Sender or recipient or admin can update trips" ON public.trips;
DROP POLICY IF EXISTS "Trip creators can update non-financial trips" ON public.trips;
DROP POLICY IF EXISTS "Assigned providers can update assigned trip workflow" ON public.trips;

CREATE POLICY "Trip creators can update non-financial trips"
  ON public.trips
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (
    auth.uid() = created_by
    AND (assigned_to IS NULL OR assigned_to <> created_by)
  );

CREATE POLICY "Assigned providers can update assigned trip workflow"
  ON public.trips
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = assigned_to
    AND (created_by IS NULL OR assigned_to <> created_by)
  )
  WITH CHECK (
    auth.uid() = assigned_to
    AND (created_by IS NULL OR assigned_to <> created_by)
  );

-- 2) Harden direct trip creation: no direct pre-assignment from the Data API.
-- Provider assignment must go through the app's controlled assignment function.
DROP POLICY IF EXISTS "Signed in users can create trips" ON public.trips;
DROP POLICY IF EXISTS "Active members can create trips" ON public.trips;

CREATE POLICY "Signed in users can create trips"
  ON public.trips
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND assigned_to IS NULL
  );

-- 3) Remove table-wide client UPDATE and grant only safe, non-financial columns.
REVOKE UPDATE ON public.trips FROM authenticated;

GRANT UPDATE (
  status,
  hipaa_ack_id,
  patient_phone,
  emergency_contact_name,
  emergency_contact_phone,
  pickup_address,
  pickup_address_details,
  pickup_city,
  pickup_zip,
  pickup_date,
  pickup_time,
  appointment_time,
  return_pickup_time,
  return_dropoff_time,
  dropoff_address,
  dropoff_city,
  dropoff_zip,
  mobility_notes,
  special_instructions,
  cancel_reason,
  no_show_reason,
  actual_pickup_at,
  actual_dropoff_at,
  odometer_start,
  odometer_end,
  mileage,
  signature_name,
  signature_signed_at,
  signature_relation,
  completed_at,
  completed_by,
  completion_source,
  updated_at
) ON public.trips TO authenticated;

-- 4) Trigger-level guard: never allow requester/provider self-assignment.
CREATE OR REPLACE FUNCTION public.prevent_trip_self_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.created_by IS NOT NULL
     AND NEW.assigned_to IS NOT NULL
     AND NEW.created_by = NEW.assigned_to THEN
    RAISE EXCEPTION 'Trip creator cannot also be the assigned provider.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_prevent_trip_self_assignment ON public.trips;
CREATE TRIGGER trg_prevent_trip_self_assignment
  BEFORE INSERT OR UPDATE OF created_by, assigned_to ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_trip_self_assignment();

-- 5) Trigger-level guard: non-service clients cannot alter trip money fields.
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

  -- Trusted backend/service processes are the only path for approved quote
  -- application, payment capture sync, payout validation, and payout release.
  IF v_claims IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.cost_total IS DISTINCT FROM OLD.cost_total
     OR NEW.cost_breakdown IS DISTINCT FROM OLD.cost_breakdown
     OR NEW.estimated_cost_cents IS DISTINCT FROM OLD.estimated_cost_cents
     OR NEW.provider_payout_cents IS DISTINCT FROM OLD.provider_payout_cents
     OR NEW.platform_fee_cents IS DISTINCT FROM OLD.platform_fee_cents
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

DROP TRIGGER IF EXISTS trg_prevent_trip_financial_self_edit ON public.trips;
CREATE TRIGGER trg_prevent_trip_financial_self_edit
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_trip_financial_self_edit();

REVOKE EXECUTE ON FUNCTION public.prevent_trip_self_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_trip_financial_self_edit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_trip_self_assignment() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_trip_financial_self_edit() TO service_role;