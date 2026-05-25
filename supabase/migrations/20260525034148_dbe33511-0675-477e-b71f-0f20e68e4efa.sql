
ALTER TABLE public.provider_applications
  ADD COLUMN IF NOT EXISTS ein text,
  ADD COLUMN IF NOT EXISTS npi text,
  ADD COLUMN IF NOT EXISTS driver_license_number text,
  ADD COLUMN IF NOT EXISTS insurance_carrier text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS provider_applications_city_idx ON public.provider_applications (lower(city));
CREATE INDEX IF NOT EXISTS provider_applications_region_idx ON public.provider_applications (region);

INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-docs', 'provider-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can upload provider docs to applications folder" ON storage.objects;
CREATE POLICY "Public can upload provider docs to applications folder"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'provider-docs'
  AND (storage.foldername(name))[1] = 'applications'
);
