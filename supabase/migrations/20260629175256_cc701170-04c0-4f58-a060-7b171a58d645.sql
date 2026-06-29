
CREATE TABLE public.facility_saved_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_user_id uuid NOT NULL,
  provider_user_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (facility_user_id, provider_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facility_saved_providers TO authenticated;
GRANT ALL ON public.facility_saved_providers TO service_role;

ALTER TABLE public.facility_saved_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facility owns its saved providers"
  ON public.facility_saved_providers
  FOR ALL
  TO authenticated
  USING (facility_user_id = auth.uid())
  WITH CHECK (facility_user_id = auth.uid());

CREATE INDEX idx_fsp_facility ON public.facility_saved_providers(facility_user_id);
