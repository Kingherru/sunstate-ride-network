ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS patient_type text,
  ADD COLUMN IF NOT EXISTS patient_type_other text,
  ADD COLUMN IF NOT EXISTS patient_relationship text,
  ADD COLUMN IF NOT EXISTS patient_relationship_other text;