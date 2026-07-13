
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS availability jsonb NOT NULL DEFAULT '{"mode":"flexible","days":{}}'::jsonb;

ALTER TABLE public.drivers
  DROP CONSTRAINT IF EXISTS drivers_employment_type_check;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_employment_type_check
  CHECK (employment_type IS NULL OR employment_type IN (
    'independent_contractor','employee_w2','part_time','full_time','temporary','seasonal'
  ));
