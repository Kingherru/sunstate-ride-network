
-- 1) Enforce no self-assignment at the table level (all roles, all paths).
ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_no_self_assignment;
ALTER TABLE public.trips
  ADD CONSTRAINT trips_no_self_assignment
  CHECK (assigned_to IS NULL OR assigned_to <> created_by) NOT VALID;
ALTER TABLE public.trips VALIDATE CONSTRAINT trips_no_self_assignment;

-- 2) Column-level revoke of financial/payout columns from authenticated and anon.
--    Legitimate mutations flow through server functions using supabaseAdmin
--    (service_role), which is unaffected by these grants.
REVOKE UPDATE (
  cost_total,
  cost_breakdown,
  estimated_cost_cents,
  provider_payout_cents,
  platform_fee_cents,
  referral_fee_cents,
  referral_fee_source_user_id,
  payment_status,
  payout_status,
  payout_released_at,
  payout_transfer_id,
  payout_eligible_at,
  payout_hold_reasons,
  payout_is_medicaid,
  payout_validated_at,
  payout_validated_by,
  payout_released_by
) ON public.trips FROM authenticated, anon, PUBLIC;

-- 3) Internal trigger helpers must not be callable directly by anon/public.
REVOKE EXECUTE ON FUNCTION public.enforce_assigned_provider_is_approved() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_payout_transfer_client_write() FROM PUBLIC, anon, authenticated;
