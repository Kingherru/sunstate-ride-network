ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS appointment_time time,
  ADD COLUMN IF NOT EXISTS return_pickup_time time,
  ADD COLUMN IF NOT EXISTS return_dropoff_time time,
  ADD COLUMN IF NOT EXISTS pickup_address_details text;