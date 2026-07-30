ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS promoted_trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

CREATE INDEX IF NOT EXISTS ride_requests_promoted_trip_id_idx
  ON public.ride_requests (promoted_trip_id);