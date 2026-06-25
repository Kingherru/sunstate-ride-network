
-- Patient / member Medicaid + emergency contact fields
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS medicaid_number text,
  ADD COLUMN IF NOT EXISTS medicaid_plan text,
  ADD COLUMN IF NOT EXISTS npi text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- Per-trip Medicaid / CMS fields + signature & mileage for trip log
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS patient_date_of_birth date,
  ADD COLUMN IF NOT EXISTS medicaid_number text,
  ADD COLUMN IF NOT EXISTS medicaid_plan text,
  ADD COLUMN IF NOT EXISTS authorization_number text,
  ADD COLUMN IF NOT EXISTS diagnosis_code text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS odometer_start integer,
  ADD COLUMN IF NOT EXISTS odometer_end integer,
  ADD COLUMN IF NOT EXISTS mileage numeric(8,2),
  ADD COLUMN IF NOT EXISTS signature_name text,
  ADD COLUMN IF NOT EXISTS signature_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_relation text;
