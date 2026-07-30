ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS return_pickup_building text,
  ADD COLUMN IF NOT EXISTS return_pickup_doctor text,
  ADD COLUMN IF NOT EXISTS return_pickup_suite text,
  ADD COLUMN IF NOT EXISTS is_medicaid_patient boolean NOT NULL DEFAULT false;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS return_pickup_building text,
  ADD COLUMN IF NOT EXISTS return_pickup_doctor text,
  ADD COLUMN IF NOT EXISTS return_pickup_suite text,
  ADD COLUMN IF NOT EXISTS is_medicaid_patient boolean NOT NULL DEFAULT false;

UPDATE public.trips SET is_medicaid_patient = true
  WHERE is_medicaid_patient = false
    AND (coalesce(medicaid_number,'') <> '' OR coalesce(medicaid_plan,'') <> '' OR lower(coalesce(payer,'')) LIKE '%medicaid%');

UPDATE public.ride_requests SET is_medicaid_patient = true
  WHERE is_medicaid_patient = false
    AND (coalesce(medicaid_number,'') <> '' OR coalesce(medicaid_plan,'') <> '' OR lower(coalesce(payer,'')) LIKE '%medicaid%');