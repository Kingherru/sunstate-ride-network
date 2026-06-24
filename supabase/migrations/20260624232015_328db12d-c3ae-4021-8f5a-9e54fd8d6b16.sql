
-- ============================================================
-- TRACK A: Security hardening
-- ============================================================
DROP POLICY IF EXISTS "Active members can see peers in their region" ON public.member_profiles;

DO $$ BEGIN
  CREATE TYPE public.membership_tier AS ENUM ('none', 'free', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS membership_tier public.membership_tier NOT NULL DEFAULT 'none';

UPDATE public.member_profiles
   SET membership_tier = 'paid'
 WHERE membership_status = 'active' AND membership_tier = 'none';

CREATE OR REPLACE VIEW public.member_directory
WITH (security_invoker = true) AS
SELECT
  mp.user_id,
  COALESCE(NULLIF(TRIM(CONCAT(mp.first_name, ' ', mp.last_name)), ''), mp.company_name) AS display_name,
  mp.company_name, mp.city, mp.region, mp.preferred_zip_codes, mp.membership_tier
FROM public.member_profiles mp
WHERE mp.membership_status = 'active';
GRANT SELECT ON public.member_directory TO authenticated;

CREATE POLICY "Active members can browse directory"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (
    membership_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.member_profiles me
      WHERE me.user_id = auth.uid() AND me.membership_status = 'active'
    )
  );

REVOKE SELECT ON public.member_profiles FROM authenticated;
GRANT SELECT (id, user_id, provider_application_id, first_name, last_name, company_name,
              city, region, preferred_zip_codes, membership_tier, membership_status, created_at, updated_at)
  ON public.member_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_billing_self_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claims', true) IS NULL
     OR (current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.membership_status := 'inactive';
    NEW.membership_tier := 'none';
    NEW.stripe_customer_id := NULL;
    NEW.stripe_subscription_id := NULL;
    NEW.current_period_end := NULL;
    RETURN NEW;
  END IF;
  NEW.membership_status := OLD.membership_status;
  NEW.membership_tier := OLD.membership_tier;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.current_period_end := OLD.current_period_end;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS prevent_billing_self_edit_trg ON public.member_profiles;
CREATE TRIGGER prevent_billing_self_edit_trg
  BEFORE INSERT OR UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_billing_self_edit();

CREATE OR REPLACE FUNCTION public.sync_member_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_status text; new_tier public.membership_tier;
BEGIN
  IF NEW.status IN ('active', 'trialing') AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now()) THEN
    new_status := 'active'; new_tier := 'paid';
  ELSIF NEW.status = 'past_due' THEN
    new_status := 'past_due'; new_tier := 'paid';
  ELSIF NEW.status = 'canceled' AND NEW.current_period_end > now() THEN
    new_status := 'active'; new_tier := 'paid';
  ELSE
    new_status := 'active'; new_tier := 'free';
  END IF;
  UPDATE public.member_profiles
     SET membership_status = new_status, membership_tier = new_tier,
         stripe_customer_id = NEW.stripe_customer_id,
         stripe_subscription_id = NEW.stripe_subscription_id,
         current_period_end = NEW.current_period_end
   WHERE user_id = NEW.user_id;
  RETURN NEW;
END; $$;

DROP POLICY IF EXISTS "Public can upload provider docs to applications folder" ON storage.objects;
CREATE POLICY "Authenticated can upload provider docs to applications folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'provider-docs' AND (storage.foldername(name))[1] = 'applications');
CREATE POLICY "Only admins can update provider docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'provider-docs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete provider docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'provider-docs' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- TRACK B: tier gating
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_send_trips(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.member_profiles
                  WHERE user_id = _user_id
                    AND membership_status = 'active'
                    AND membership_tier = 'paid');
$$;
REVOKE EXECUTE ON FUNCTION public.can_send_trips(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_send_trips(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Active members can create trips" ON public.trips;
CREATE POLICY "Paid members can create trips"
  ON public.trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.can_send_trips(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_grant_free_membership(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.member_profiles
     SET membership_status = 'active', membership_tier = 'free'
   WHERE user_id = _user_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_free_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_free_membership(uuid) TO authenticated;

-- ============================================================
-- TRACK C: HIPAA + PHI redaction
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hipaa_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT 'v1',
  context TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);
GRANT SELECT, INSERT ON public.hipaa_acknowledgments TO authenticated;
GRANT ALL ON public.hipaa_acknowledgments TO service_role;
ALTER TABLE public.hipaa_acknowledgments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own acks" ON public.hipaa_acknowledgments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own acks" ON public.hipaa_acknowledgments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS hipaa_ack_id UUID REFERENCES public.hipaa_acknowledgments(id);
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS hipaa_ack_id UUID REFERENCES public.hipaa_acknowledgments(id);

DROP POLICY IF EXISTS "Sender or recipient or admin can view trips" ON public.trips;
CREATE POLICY "Sender or recipient can view trips"
  ON public.trips FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE OR REPLACE VIEW public.trips_admin_metadata AS
SELECT id, created_by, assigned_to, region, status, source,
       pickup_city, pickup_zip, pickup_date, pickup_time,
       dropoff_city, dropoff_zip, transport_type, round_trip,
       payer, trip_number, hipaa_ack_id, cost_total, created_at, updated_at
FROM public.trips;
REVOKE ALL ON public.trips_admin_metadata FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_trips_admin_metadata()
RETURNS SETOF public.trips_admin_metadata
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.trips_admin_metadata
   WHERE public.has_role(auth.uid(), 'admin');
$$;
REVOKE EXECUTE ON FUNCTION public.get_trips_admin_metadata() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trips_admin_metadata() TO authenticated;

REVOKE UPDATE ON public.trips FROM authenticated;
GRANT UPDATE (status, assigned_to, hipaa_ack_id, cost_breakdown, cost_total)
  ON public.trips TO authenticated;
GRANT UPDATE ON public.trips TO service_role;

-- ============================================================
-- TRACK D: Phase 4 scaffolding
-- ============================================================
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
  ADD COLUMN IF NOT EXISTS requester_email TEXT,
  ADD COLUMN IF NOT EXISTS requester_phone TEXT;

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'requester';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.requester_saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  zip TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requester_saved_locations TO authenticated;
GRANT ALL ON public.requester_saved_locations TO service_role;
ALTER TABLE public.requester_saved_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own requester locations"
  ON public.requester_saved_locations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.provider_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL CHECK (vendor IN ('hibambi', 'routegenie')),
  api_key_encrypted TEXT,
  webhook_secret TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, vendor)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_integrations TO authenticated;
GRANT ALL ON public.provider_integrations TO service_role;
ALTER TABLE public.provider_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins can manage integrations"
  ON public.provider_integrations FOR ALL TO authenticated
  USING (auth.uid() = provider_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = provider_id OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS set_updated_at_requester_loc ON public.requester_saved_locations;
CREATE TRIGGER set_updated_at_requester_loc BEFORE UPDATE ON public.requester_saved_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_provider_integrations ON public.provider_integrations;
CREATE TRIGGER set_updated_at_provider_integrations BEFORE UPDATE ON public.provider_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
