
-- 1. Vehicle registration + Medicaid cert expiry columns
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS registration_expiry date,
  ADD COLUMN IF NOT EXISTS registration_doc_path text;

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS medicaid_cert_expires_at date,
  ADD COLUMN IF NOT EXISTS medicaid_cert_doc_path text;

-- 2. Custom provider credentials table
CREATE TABLE IF NOT EXISTS public.provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  doc_path text,
  expires_at date,
  required boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_credentials TO authenticated;
GRANT ALL ON public.provider_credentials TO service_role;
ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers manage own credentials"
  ON public.provider_credentials FOR ALL TO authenticated
  USING (provider_user_id = auth.uid())
  WITH CHECK (provider_user_id = auth.uid());
CREATE POLICY "dispatch staff view all credentials"
  ON public.provider_credentials FOR SELECT TO authenticated
  USING (public.is_ops_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_provider_credentials_user ON public.provider_credentials(provider_user_id);
CREATE INDEX IF NOT EXISTS idx_provider_credentials_expires ON public.provider_credentials(expires_at);

CREATE TRIGGER trg_provider_credentials_updated_at
  BEFORE UPDATE ON public.provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Medicaid contacts (per-provider + optional statewide directory)
CREATE TABLE IF NOT EXISTS public.medicaid_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  organization text,
  email text,
  phone text,
  notes text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicaid_contacts TO authenticated;
GRANT ALL ON public.medicaid_contacts TO service_role;
ALTER TABLE public.medicaid_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers manage own medicaid contacts"
  ON public.medicaid_contacts FOR ALL TO authenticated
  USING (provider_user_id = auth.uid())
  WITH CHECK (provider_user_id = auth.uid());
CREATE POLICY "authenticated view public directory"
  ON public.medicaid_contacts FOR SELECT TO authenticated
  USING (is_public = true);
CREATE POLICY "dispatch staff view all medicaid contacts"
  ON public.medicaid_contacts FOR SELECT TO authenticated
  USING (public.is_ops_staff(auth.uid()));

CREATE TRIGGER trg_medicaid_contacts_updated_at
  BEFORE UPDATE ON public.medicaid_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Medicaid packets
CREATE TABLE IF NOT EXISTS public.medicaid_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  medicaid_contact_id uuid REFERENCES public.medicaid_contacts(id) ON DELETE SET NULL,
  submission_reference text,
  notes text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicaid_packets TO authenticated;
GRANT ALL ON public.medicaid_packets TO service_role;
ALTER TABLE public.medicaid_packets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers manage own packets"
  ON public.medicaid_packets FOR ALL TO authenticated
  USING (provider_user_id = auth.uid())
  WITH CHECK (provider_user_id = auth.uid());
CREATE POLICY "dispatch staff view packets"
  ON public.medicaid_packets FOR SELECT TO authenticated
  USING (public.is_ops_staff(auth.uid()));

CREATE TRIGGER trg_medicaid_packets_updated_at
  BEFORE UPDATE ON public.medicaid_packets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_medicaid_packets_provider ON public.medicaid_packets(provider_user_id);

-- 5. Packet items
CREATE TABLE IF NOT EXISTS public.medicaid_packet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES public.medicaid_packets(id) ON DELETE CASCADE,
  kind text NOT NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  doc_path text,
  label text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicaid_packet_items TO authenticated;
GRANT ALL ON public.medicaid_packet_items TO service_role;
ALTER TABLE public.medicaid_packet_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers manage own packet items"
  ON public.medicaid_packet_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medicaid_packets p WHERE p.id = packet_id AND p.provider_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.medicaid_packets p WHERE p.id = packet_id AND p.provider_user_id = auth.uid()));
CREATE POLICY "dispatch staff view packet items"
  ON public.medicaid_packet_items FOR SELECT TO authenticated
  USING (public.is_ops_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_medicaid_packet_items_packet ON public.medicaid_packet_items(packet_id);

-- 6. Credential validity helper
CREATE OR REPLACE FUNCTION public.provider_has_valid_credentials(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today date := current_date;
  v_medicaid date;
  v_bad_custom int;
  v_bad_vehicle int;
  v_bad_driver int;
BEGIN
  SELECT medicaid_cert_expires_at INTO v_medicaid FROM public.member_profiles WHERE user_id = _user_id;
  IF v_medicaid IS NOT NULL AND v_medicaid < v_today THEN RETURN false; END IF;

  SELECT count(*) INTO v_bad_custom
    FROM public.provider_credentials
   WHERE provider_user_id = _user_id
     AND required = true
     AND expires_at IS NOT NULL
     AND expires_at < v_today;
  IF v_bad_custom > 0 THEN RETURN false; END IF;

  SELECT count(*) INTO v_bad_vehicle
    FROM public.vehicles
   WHERE owner_id = _user_id
     AND status = 'active'
     AND (
       (insurance_expiry IS NOT NULL AND insurance_expiry < v_today)
       OR (registration_expiry IS NOT NULL AND registration_expiry < v_today)
     );
  IF v_bad_vehicle > 0 THEN RETURN false; END IF;

  SELECT count(*) INTO v_bad_driver
    FROM public.drivers
   WHERE owner_id = _user_id
     AND status = 'active'
     AND license_expiry IS NOT NULL
     AND license_expiry < v_today;
  IF v_bad_driver > 0 THEN RETURN false; END IF;

  RETURN true;
END $$;

-- 7. Trigger: block assigning trips to providers with expired credentials, and notify dispatch leadership.
CREATE OR REPLACE FUNCTION public.enforce_provider_credentials_on_assign()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
     AND NOT public.provider_has_valid_credentials(NEW.assigned_to) THEN
    -- Notify all dispatch leadership
    FOR r IN
      SELECT DISTINCT user_id FROM public.user_roles
       WHERE role IN ('admin','app_manager','dispatcher')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        r.user_id,
        'provider_credentials_expired',
        'Blocked: provider credentials expired',
        'Tried to assign trip ' || coalesce(NEW.display_id, NEW.id::text) ||
        ' to a provider with expired credentials. Assignment was blocked.',
        '/admin'
      );
    END LOOP;
    RAISE EXCEPTION 'Provider credentials are expired; assignment blocked.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_provider_credentials_on_assign ON public.trips;
CREATE TRIGGER trg_enforce_provider_credentials_on_assign
  BEFORE UPDATE OF assigned_to ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.enforce_provider_credentials_on_assign();

-- 8. Expiring credentials view (30-day horizon) for dispatch dashboards
CREATE OR REPLACE VIEW public.expiring_provider_credentials AS
  SELECT mp.user_id AS provider_user_id,
         mp.display_id AS provider_display_id,
         mp.company_name,
         'medicaid_certification'::text AS kind,
         'Medicaid Certification'::text AS label,
         mp.medicaid_cert_expires_at AS expires_at,
         mp.medicaid_cert_expires_at - current_date AS days_until_expiry
    FROM public.member_profiles mp
   WHERE mp.medicaid_cert_expires_at IS NOT NULL
     AND mp.medicaid_cert_expires_at <= current_date + INTERVAL '30 days'
  UNION ALL
  SELECT v.owner_id, mp.display_id, mp.company_name,
         'vehicle_insurance', 'Vehicle Insurance — ' || coalesce(v.name, v.plate, 'vehicle'),
         v.insurance_expiry, v.insurance_expiry - current_date
    FROM public.vehicles v
    LEFT JOIN public.member_profiles mp ON mp.user_id = v.owner_id
   WHERE v.status = 'active'
     AND v.insurance_expiry IS NOT NULL
     AND v.insurance_expiry <= current_date + INTERVAL '30 days'
  UNION ALL
  SELECT v.owner_id, mp.display_id, mp.company_name,
         'vehicle_registration', 'Vehicle Registration — ' || coalesce(v.name, v.plate, 'vehicle'),
         v.registration_expiry, v.registration_expiry - current_date
    FROM public.vehicles v
    LEFT JOIN public.member_profiles mp ON mp.user_id = v.owner_id
   WHERE v.status = 'active'
     AND v.registration_expiry IS NOT NULL
     AND v.registration_expiry <= current_date + INTERVAL '30 days'
  UNION ALL
  SELECT d.owner_id, mp.display_id, mp.company_name,
         'driver_license', 'Driver License — ' || coalesce(d.first_name || ' ' || d.last_name, 'driver'),
         d.license_expiry, d.license_expiry - current_date
    FROM public.drivers d
    LEFT JOIN public.member_profiles mp ON mp.user_id = d.owner_id
   WHERE d.status = 'active'
     AND d.license_expiry IS NOT NULL
     AND d.license_expiry <= current_date + INTERVAL '30 days'
  UNION ALL
  SELECT pc.provider_user_id, mp.display_id, mp.company_name,
         pc.kind, pc.label, pc.expires_at, pc.expires_at - current_date
    FROM public.provider_credentials pc
    LEFT JOIN public.member_profiles mp ON mp.user_id = pc.provider_user_id
   WHERE pc.expires_at IS NOT NULL
     AND pc.expires_at <= current_date + INTERVAL '30 days';

GRANT SELECT ON public.expiring_provider_credentials TO authenticated;

-- Wrapper RPC restricted to ops staff (view has no RLS)
CREATE OR REPLACE FUNCTION public.list_expiring_provider_credentials()
RETURNS SETOF public.expiring_provider_credentials
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.expiring_provider_credentials
   WHERE public.is_ops_staff(auth.uid())
   ORDER BY expires_at ASC NULLS LAST
$$;
