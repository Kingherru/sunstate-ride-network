
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS return_date DATE;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS return_date DATE;
COMMENT ON COLUMN public.trips.return_date IS 'Return leg date for round trips. Defaults to pickup_date if unset, may differ for multi-day (e.g. surgery) trips.';
COMMENT ON COLUMN public.ride_requests.return_date IS 'Return leg date for round trip requests.';
