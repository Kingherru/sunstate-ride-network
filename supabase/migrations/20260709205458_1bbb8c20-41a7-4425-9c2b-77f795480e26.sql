
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS payer text,
  ADD COLUMN IF NOT EXISTS medicaid_number text,
  ADD COLUMN IF NOT EXISTS medicaid_plan text,
  ADD COLUMN IF NOT EXISTS patient_date_of_birth date,
  ADD COLUMN IF NOT EXISTS patient_gender text,
  ADD COLUMN IF NOT EXISTS diagnosis_code text,
  ADD COLUMN IF NOT EXISTS authorization_number text;

-- Fast filter for Medicaid reservations in the Provider Portal
CREATE INDEX IF NOT EXISTS idx_ride_requests_medicaid
  ON public.ride_requests ((lower(coalesce(payer,''))))
  WHERE payer IS NOT NULL;
