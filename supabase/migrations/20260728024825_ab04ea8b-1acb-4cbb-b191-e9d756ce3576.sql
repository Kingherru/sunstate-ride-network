
-- 1) Revoke anon/public EXECUTE on internal trigger definer functions
REVOKE EXECUTE ON FUNCTION public.sync_fin_fee_to_platform() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_platform_fee_to_fin() FROM PUBLIC, anon, authenticated;

-- 2) Replace open-listing PHI exposure with a filtered view
DROP POLICY IF EXISTS "Providers can view open ride requests" ON public.ride_requests;

DROP VIEW IF EXISTS public.open_ride_requests_public;
CREATE VIEW public.open_ride_requests_public
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  r.id,
  r.status,
  r.created_at,
  r.pickup_date,
  r.pickup_time,
  r.appointment_time,
  r.return_date,
  r.return_pickup_time,
  r.return_dropoff_time,
  r.round_trip,
  r.trip_type,
  r.transport_type,
  r.service_level,
  r.needs_wheelchair,
  r.dispatch_source,
  r.requester_user_id,
  r.pickup_address,
  r.pickup_address_details,
  r.pickup_city,
  r.pickup_zip,
  r.pickup_lat,
  r.pickup_lng,
  r.dropoff_address,
  r.dropoff_city,
  r.dropoff_zip,
  r.dropoff_lat,
  r.dropoff_lng,
  r.distance_miles,
  r.estimated_cost_cents,
  r.estimated_duration_seconds,
  r.estimated_duration_traffic_seconds,
  r.payer,
  -- Non-PHI medicaid flag (no plan name, no member #)
  (COALESCE(r.payer,'') ILIKE '%medicaid%'
    OR r.medicaid_number IS NOT NULL
    OR r.medicaid_plan IS NOT NULL) AS is_medicaid
FROM public.ride_requests r
WHERE r.assigned_provider_id IS NULL
  AND r.status = ANY (ARRAY['pending','open','new'])
  AND public.is_approved_provider(auth.uid())
  AND public.provider_can_serve_ride(
    auth.uid(),
    r.pickup_lat, r.pickup_lng,
    r.dropoff_lat, r.dropoff_lng,
    r.distance_miles
  );

REVOKE ALL ON public.open_ride_requests_public FROM PUBLIC, anon;
GRANT SELECT ON public.open_ride_requests_public TO authenticated;

-- Providers still need to be able to claim (UPDATE) unassigned rows; that policy remains untouched.
-- Ensure providers can still SELECT rows they've been assigned (so claim + read after works).
DROP POLICY IF EXISTS "Providers can view their assigned ride requests" ON public.ride_requests;
CREATE POLICY "Providers can view their assigned ride requests"
  ON public.ride_requests
  FOR SELECT
  TO authenticated
  USING (assigned_provider_id = auth.uid());
