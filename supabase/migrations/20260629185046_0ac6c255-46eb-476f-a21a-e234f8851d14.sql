-- 1) saved_patients
CREATE TABLE public.saved_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  dob date,
  phone text,
  email text,
  medicaid_id text,
  mobility text,
  notes text,
  default_pickup_address text,
  default_pickup_city text,
  default_dropoff_address text,
  default_dropoff_city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_patients TO authenticated;
GRANT ALL ON public.saved_patients TO service_role;

ALTER TABLE public.saved_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select saved_patients"
  ON public.saved_patients FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "owner insert saved_patients"
  ON public.saved_patients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update saved_patients"
  ON public.saved_patients FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner delete saved_patients"
  ON public.saved_patients FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER set_saved_patients_updated_at
  BEFORE UPDATE ON public.saved_patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX saved_patients_owner_idx ON public.saved_patients(owner_id);

-- 2) link saved_payment_methods to a patient (facility multi-patient case)
ALTER TABLE public.saved_payment_methods
  ADD COLUMN patient_id uuid REFERENCES public.saved_patients(id) ON DELETE SET NULL,
  ADD COLUMN label text;

CREATE INDEX saved_payment_methods_patient_idx
  ON public.saved_payment_methods(patient_id);

-- 3) provider_pricing wait time unit
ALTER TABLE public.provider_pricing
  ADD COLUMN wait_unit text NOT NULL DEFAULT 'hour'
    CHECK (wait_unit IN ('minute','half_hour','hour')),
  ADD COLUMN pay_wait_unit text
    CHECK (pay_wait_unit IN ('minute','half_hour','hour'));