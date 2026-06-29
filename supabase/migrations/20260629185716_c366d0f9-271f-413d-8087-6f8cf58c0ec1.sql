ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS appointment_time text,
  ADD COLUMN IF NOT EXISTS return_pickup_time text,
  ADD COLUMN IF NOT EXISTS return_dropoff_time text;