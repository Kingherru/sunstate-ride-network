
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS service_radius_miles integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS long_distance_ok boolean NOT NULL DEFAULT false;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS dispatch_source text NOT NULL DEFAULT 'patient';
-- Allowed values: 'patient' | 'facility' | 'provider' | 'auto'
COMMENT ON COLUMN public.ride_requests.dispatch_source IS 'patient|facility|provider|auto — auto means FloridaNEMT routed it to nearby providers by ZIP';

-- Let approved providers see open requests they could claim
DROP POLICY IF EXISTS "Providers can view open ride requests" ON public.ride_requests;
CREATE POLICY "Providers can view open ride requests"
ON public.ride_requests
FOR SELECT
TO authenticated
USING (
  public.is_approved_provider(auth.uid())
  AND status IN ('pending','open','new')
  AND assigned_provider_id IS NULL
);

-- Let approved providers claim/deny open requests
DROP POLICY IF EXISTS "Providers can claim open ride requests" ON public.ride_requests;
CREATE POLICY "Providers can claim open ride requests"
ON public.ride_requests
FOR UPDATE
TO authenticated
USING (
  public.is_approved_provider(auth.uid())
  AND (assigned_provider_id IS NULL OR assigned_provider_id = auth.uid())
)
WITH CHECK (
  public.is_approved_provider(auth.uid())
  AND (assigned_provider_id IS NULL OR assigned_provider_id = auth.uid())
);
