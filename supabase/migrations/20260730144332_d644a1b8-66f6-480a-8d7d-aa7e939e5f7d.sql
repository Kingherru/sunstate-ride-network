DROP VIEW IF EXISTS public.open_ride_requests_public;

CREATE OR REPLACE FUNCTION public.list_open_ride_requests()
RETURNS TABLE (
  id uuid,
  status text,
  created_at timestamptz,
  pickup_date date,
  pickup_time time without time zone,
  appointment_time text,
  return_date date,
  return_pickup_time text,
  return_dropoff_time text,
  round_trip boolean,
  trip_type text,
  transport_type text,
  service_level text,
  needs_wheelchair boolean,
  dispatch_source text,
  requester_user_id uuid,
  pickup_address text,
  pickup_address_details text,
  pickup_city text,
  pickup_zip text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  dropoff_city text,
  dropoff_zip text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  distance_miles numeric,
  estimated_cost_cents integer,
  estimated_duration_seconds integer,
  estimated_duration_traffic_seconds integer,
  payer text,
  is_medicaid boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.status, r.created_at, r.pickup_date, r.pickup_time, r.appointment_time,
         r.return_date, r.return_pickup_time, r.return_dropoff_time, r.round_trip,
         r.trip_type, r.transport_type, r.service_level::text, r.needs_wheelchair, r.dispatch_source,
         r.requester_user_id, r.pickup_address, r.pickup_address_details, r.pickup_city, r.pickup_zip,
         r.pickup_lat, r.pickup_lng, r.dropoff_address, r.dropoff_city, r.dropoff_zip,
         r.dropoff_lat, r.dropoff_lng, r.distance_miles, r.estimated_cost_cents,
         r.estimated_duration_seconds, r.estimated_duration_traffic_seconds, r.payer,
         (COALESCE(r.payer,'') ILIKE '%medicaid%' OR r.medicaid_number IS NOT NULL OR r.medicaid_plan IS NOT NULL) AS is_medicaid
  FROM public.ride_requests r
  WHERE auth.uid() IS NOT NULL
    AND r.assigned_provider_id IS NULL
    AND r.status = ANY (ARRAY['pending','open','new'])
    AND public.is_approved_provider(auth.uid())
    AND public.provider_can_serve_ride(auth.uid(), r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng, r.distance_miles)
  ORDER BY r.pickup_date;
$$;

REVOKE ALL ON FUNCTION public.list_open_ride_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_open_ride_requests() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_open_ride_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_ride_requests() TO service_role;