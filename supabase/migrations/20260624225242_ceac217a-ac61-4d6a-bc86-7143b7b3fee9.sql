
-- provider_contacts
CREATE TABLE public.provider_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_type text NOT NULL CHECK (contact_type IN ('patient','caregiver','facility','broker','organization')),
  first_name text,
  last_name text,
  company_name text,
  phone text,
  email text,
  payer text,
  mobility_notes text,
  notes text,
  default_pickup_location_id uuid,
  default_dropoff_location_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_contacts TO authenticated;
GRANT ALL ON public.provider_contacts TO service_role;

ALTER TABLE public.provider_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their contacts"
  ON public.provider_contacts FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_provider_contacts_owner ON public.provider_contacts(owner_id);
CREATE INDEX idx_provider_contacts_type ON public.provider_contacts(owner_id, contact_type);

CREATE TRIGGER set_provider_contacts_updated_at
  BEFORE UPDATE ON public.provider_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- saved_locations
CREATE TABLE public.saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.provider_contacts(id) ON DELETE SET NULL,
  label text NOT NULL,
  address text NOT NULL,
  city text,
  state text DEFAULT 'FL',
  zip text,
  lat numeric,
  lng numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_locations TO authenticated;
GRANT ALL ON public.saved_locations TO service_role;

ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their saved locations"
  ON public.saved_locations FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_saved_locations_owner ON public.saved_locations(owner_id);
CREATE INDEX idx_saved_locations_contact ON public.saved_locations(contact_id);

CREATE TRIGGER set_saved_locations_updated_at
  BEFORE UPDATE ON public.saved_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK back from provider_contacts to saved_locations (deferred to avoid circular create)
ALTER TABLE public.provider_contacts
  ADD CONSTRAINT provider_contacts_default_pickup_fk
  FOREIGN KEY (default_pickup_location_id) REFERENCES public.saved_locations(id) ON DELETE SET NULL;

ALTER TABLE public.provider_contacts
  ADD CONSTRAINT provider_contacts_default_dropoff_fk
  FOREIGN KEY (default_dropoff_location_id) REFERENCES public.saved_locations(id) ON DELETE SET NULL;

-- link trips to CRM entries
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.provider_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_location_id uuid REFERENCES public.saved_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dropoff_location_id uuid REFERENCES public.saved_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_contact ON public.trips(contact_id);
