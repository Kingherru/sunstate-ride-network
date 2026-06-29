
-- Geocoding & distance enforcement for ride routing
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS pickup_zip text,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision,
  ADD COLUMN IF NOT EXISTS distance_miles numeric(8,2),
  ADD COLUMN IF NOT EXISTS estimated_cost_cents integer;

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision;

-- Haversine miles between two coordinates
CREATE OR REPLACE FUNCTION public.haversine_miles(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 3958.8 * 2 * asin(sqrt(
    sin(radians((lat2 - lat1)/2))^2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians((lng2 - lng1)/2))^2
  ));
$$;

-- True if the provider's network covers a given pickup point (and trip length).
CREATE OR REPLACE FUNCTION public.provider_covers_pickup(_provider_id uuid, _pickup_lat double precision, _pickup_lng double precision, _trip_miles numeric)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_profiles mp
    WHERE mp.user_id = _provider_id
      AND mp.center_lat IS NOT NULL AND mp.center_lng IS NOT NULL
      AND (_pickup_lat IS NULL OR _pickup_lng IS NULL
           OR public.haversine_miles(mp.center_lat, mp.center_lng, _pickup_lat, _pickup_lng) <= COALESCE(mp.service_radius_miles, 25))
      AND (COALESCE(_trip_miles, 0) < 50 OR COALESCE(mp.long_distance_ok, false) = true)
  );
$$;

REVOKE ALL ON FUNCTION public.provider_covers_pickup(uuid, double precision, double precision, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_covers_pickup(uuid, double precision, double precision, numeric) TO authenticated, service_role;

-- Tighten provider SELECT visibility: only see open requests their network covers
DROP POLICY IF EXISTS "Providers can view open ride requests" ON public.ride_requests;
CREATE POLICY "Providers can view open ride requests"
ON public.ride_requests FOR SELECT
USING (
  is_approved_provider(auth.uid())
  AND status = ANY (ARRAY['pending'::text, 'open'::text, 'new'::text])
  AND assigned_provider_id IS NULL
  AND public.provider_covers_pickup(auth.uid(), pickup_lat, pickup_lng, distance_miles)
);

DROP POLICY IF EXISTS "Providers can claim open ride requests" ON public.ride_requests;
CREATE POLICY "Providers can claim open ride requests"
ON public.ride_requests FOR UPDATE
USING (
  is_approved_provider(auth.uid())
  AND (assigned_provider_id IS NULL OR assigned_provider_id = auth.uid())
  AND (assigned_provider_id = auth.uid() OR public.provider_covers_pickup(auth.uid(), pickup_lat, pickup_lng, distance_miles))
)
WITH CHECK (
  is_approved_provider(auth.uid())
  AND (assigned_provider_id IS NULL OR assigned_provider_id = auth.uid())
);
