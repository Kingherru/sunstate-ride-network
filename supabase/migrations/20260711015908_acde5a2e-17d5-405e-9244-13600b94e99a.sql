ALTER TABLE public.saved_patients
  ADD COLUMN IF NOT EXISTS payer text,
  ADD COLUMN IF NOT EXISTS medicaid_number text,
  ADD COLUMN IF NOT EXISTS medicaid_plan text,
  ADD COLUMN IF NOT EXISTS diagnosis_code text,
  ADD COLUMN IF NOT EXISTS authorization_number text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text;