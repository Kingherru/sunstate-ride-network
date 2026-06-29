
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS trip_type text NOT NULL DEFAULT 'one_way',
  ADD COLUMN IF NOT EXISTS additional_stops jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.ride_requests
  DROP CONSTRAINT IF EXISTS ride_requests_trip_type_check;
ALTER TABLE public.ride_requests
  ADD CONSTRAINT ride_requests_trip_type_check
  CHECK (trip_type IN ('one_way','round_trip','multi_trip'));

UPDATE public.ride_requests
   SET trip_type = 'round_trip'
 WHERE round_trip = true AND trip_type = 'one_way';
