
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS estimated_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS estimated_duration_traffic_seconds integer,
  ADD COLUMN IF NOT EXISTS route_polyline text,
  ADD COLUMN IF NOT EXISTS route_computed_at timestamptz;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS estimated_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS estimated_duration_traffic_seconds integer,
  ADD COLUMN IF NOT EXISTS route_polyline text,
  ADD COLUMN IF NOT EXISTS pickup_lat double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lat double precision,
  ADD COLUMN IF NOT EXISTS dropoff_lng double precision,
  ADD COLUMN IF NOT EXISTS route_computed_at timestamptz;
