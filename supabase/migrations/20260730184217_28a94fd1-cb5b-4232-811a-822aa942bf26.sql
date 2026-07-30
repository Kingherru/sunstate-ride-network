
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS duet_ride_id text,
  ADD COLUMN IF NOT EXISTS duet_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS duet_last_event text,
  ADD COLUMN IF NOT EXISTS duet_last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS dropoff_arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_dropoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_source text,
  ADD COLUMN IF NOT EXISTS completion_attested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_attested_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_attested_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS trips_duet_ride_id_key ON public.trips (duet_ride_id) WHERE duet_ride_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.trip_dispatch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE,
  provider_id uuid,
  vendor text NOT NULL,
  event_type text NOT NULL,
  external_ride_id text,
  event_time timestamptz,
  latitude numeric,
  longitude numeric,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_dispatch_events_trip_idx ON public.trip_dispatch_events (trip_id, created_at DESC);

GRANT SELECT ON public.trip_dispatch_events TO authenticated;
GRANT ALL ON public.trip_dispatch_events TO service_role;
ALTER TABLE public.trip_dispatch_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ops staff can read dispatch events"
ON public.trip_dispatch_events FOR SELECT TO authenticated
USING (public.is_ops_staff(auth.uid()));

CREATE POLICY "Trip parties can read their dispatch events"
ON public.trip_dispatch_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.trips t
  WHERE t.id = trip_dispatch_events.trip_id
    AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid())
));
