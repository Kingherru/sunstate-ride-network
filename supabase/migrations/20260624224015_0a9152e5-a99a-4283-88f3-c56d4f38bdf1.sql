
-- ============ MEMBER PROFILES ============
CREATE TABLE public.member_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_application_id uuid REFERENCES public.provider_applications(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  company_name text,
  phone text,
  dispatch_email text,
  city text,
  region text,
  preferred_zip_codes text[] NOT NULL DEFAULT '{}',
  membership_status text NOT NULL DEFAULT 'inactive', -- inactive | active | past_due | canceled
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.member_profiles TO authenticated;
GRANT ALL ON public.member_profiles TO service_role;

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own profile"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can update their own profile"
  ON public.member_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can create their own profile"
  ON public.member_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Active members in same region (for dispatch directory)
CREATE POLICY "Active members can see peers in their region"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (
    membership_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.member_profiles me
      WHERE me.user_id = auth.uid()
        AND me.membership_status = 'active'
        AND me.region = member_profiles.region
    )
  );

-- ============ TRIPS ============
CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  region text,
  status text NOT NULL DEFAULT 'open', -- open | assigned | accepted | declined | completed | canceled
  patient_first_name text NOT NULL,
  patient_last_name text NOT NULL,
  patient_phone text,
  pickup_address text NOT NULL,
  pickup_city text NOT NULL,
  pickup_zip text,
  pickup_date date NOT NULL,
  pickup_time time NOT NULL,
  dropoff_address text NOT NULL,
  dropoff_city text NOT NULL,
  dropoff_zip text,
  transport_type text, -- ambulatory | wheelchair | stretcher
  round_trip boolean NOT NULL DEFAULT false,
  mobility_notes text,
  special_instructions text,
  payer text,
  trip_number text,
  source text NOT NULL DEFAULT 'manual', -- manual | csv | api
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trips_created_by_idx ON public.trips(created_by);
CREATE INDEX trips_assigned_to_idx ON public.trips(assigned_to);
CREATE INDEX trips_region_status_idx ON public.trips(region, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can create trips"
  ON public.trips FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM public.member_profiles WHERE user_id = auth.uid() AND membership_status = 'active')
  );

CREATE POLICY "Sender or recipient or admin can view trips"
  ON public.trips FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Sender or recipient or admin can update trips"
  ON public.trips FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Sender can delete their own trips"
  ON public.trips FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_member_profiles_updated_at
  BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
