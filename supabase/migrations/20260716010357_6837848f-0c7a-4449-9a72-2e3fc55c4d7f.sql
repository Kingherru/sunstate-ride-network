-- Add a trusted internal marker for approved financial workflows and restrict payment confirmation.

CREATE OR REPLACE FUNCTION public.prevent_trip_financial_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
  v_trusted text := current_setting('myfloridanemt.trusted_trip_financial_update', true);
BEGIN
  IF v_claims IS NOT NULL THEN
    v_role := (v_claims::jsonb ->> 'role');
  END IF;

  -- Trusted backend/service processes and explicitly marked security-definer
  -- approval flows are the only paths for money/payment/payout changes.
  IF v_claims IS NULL OR v_role = 'service_role' OR v_trusted = 'on' THEN
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

CREATE OR REPLACE FUNCTION public.apply_approved_quote_to_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    PERFORM set_config('myfloridanemt.trusted_trip_financial_update', 'on', true);
    UPDATE public.trips
       SET cost_total = (NEW.amount_cents::numeric / 100)
     WHERE id = NEW.trip_id;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.set_trip_payment_status(
  _trip_id uuid,
  _status public.trip_payment_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_trip record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, created_by, assigned_to INTO v_trip FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;

  -- Providers may not confirm payment on their own assigned trips.
  -- Payment confirmation is limited to the requester/facility that owns the trip
  -- or ops staff, then the payout service separately validates release.
  IF v_trip.created_by <> v_uid AND NOT public.is_ops_staff(v_uid) THEN
    RAISE EXCEPTION 'Not permitted to change payment status for this trip';
  END IF;

  PERFORM set_config('myfloridanemt.trusted_trip_financial_update', 'on', true);
  UPDATE public.trips SET payment_status = _status WHERE id = _trip_id;
END $function$;

REVOKE EXECUTE ON FUNCTION public.prevent_trip_self_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_trip_financial_self_edit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_approved_quote_to_trip() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_trip_payment_status(uuid, public.trip_payment_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_trip_payment_status(uuid, public.trip_payment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_trip_self_assignment() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_trip_financial_self_edit() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_approved_quote_to_trip() TO service_role;