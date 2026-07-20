
-- Replace client-trusted distance_miles gate with a server-computed haversine
-- check against the row's own pickup/dropoff coordinates. If coords are missing
-- we fall back to the stored distance_miles (so legacy rows still behave), but
-- otherwise the policy no longer trusts a value the provider could have set.

CREATE OR REPLACE FUNCTION public.provider_can_serve_ride(
  _provider_id uuid,
  _pickup_lat double precision,
  _pickup_lng double precision,
  _dropoff_lat double precision,
  _dropoff_lng double precision,
  _stored_miles numeric
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.member_profiles mp
    WHERE mp.user_id = _provider_id
      AND mp.center_lat IS NOT NULL
      AND mp.center_lng IS NOT NULL
      -- Pickup must fall within provider's service radius.
      AND (
        _pickup_lat IS NULL OR _pickup_lng IS NULL
        OR public.haversine_miles(mp.center_lat, mp.center_lng, _pickup_lat, _pickup_lng)
             <= COALESCE(mp.service_radius_miles, 25)
      )
      -- Long-distance gate: prefer server-computed pickup->dropoff haversine.
      -- Only fall back to the stored distance_miles when coordinates are missing.
      AND (
        CASE
          WHEN _pickup_lat IS NOT NULL AND _pickup_lng IS NOT NULL
           AND _dropoff_lat IS NOT NULL AND _dropoff_lng IS NOT NULL
            THEN public.haversine_miles(_pickup_lat, _pickup_lng, _dropoff_lat, _dropoff_lng)
          ELSE COALESCE(_stored_miles, 0)
        END
      ) < 50
      OR COALESCE(mp.long_distance_ok, false) = true
  );
$$;

-- Only the trigger context / policies need to call this. Do not expose to app clients.
REVOKE ALL ON FUNCTION public.provider_can_serve_ride(uuid, double precision, double precision, double precision, double precision, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_can_serve_ride(uuid, double precision, double precision, double precision, double precision, numeric) TO authenticated;

-- Rewrite the two RLS policies that previously called provider_covers_pickup.
DROP POLICY IF EXISTS "Providers can claim unassigned ride requests" ON public.ride_requests;
CREATE POLICY "Providers can claim unassigned ride requests"
ON public.ride_requests
FOR UPDATE
TO authenticated
USING (
  public.is_approved_provider(auth.uid())
  AND assigned_provider_id IS NULL
  AND public.provider_can_serve_ride(
        auth.uid(), pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, distance_miles
      )
)
WITH CHECK (
  public.is_approved_provider(auth.uid())
  AND assigned_provider_id = auth.uid()
);

DROP POLICY IF EXISTS "Providers can view open ride requests" ON public.ride_requests;
CREATE POLICY "Providers can view open ride requests"
ON public.ride_requests
FOR SELECT
TO authenticated
USING (
  public.is_approved_provider(auth.uid())
  AND status = ANY (ARRAY['pending','open','new'])
  AND assigned_provider_id IS NULL
  AND public.provider_can_serve_ride(
        auth.uid(), pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, distance_miles
      )
);
