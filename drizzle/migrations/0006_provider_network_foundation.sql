ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS provider_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_workspace_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.id := OLD.id; NEW.account_type := OLD.account_type; NEW.status := OLD.status;
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    NEW.legacy_backfilled := OLD.legacy_backfilled;
    NEW.provider_verified := OLD.provider_verified;
    IF NEW.organization_type = 'needs_review' AND OLD.organization_type <> 'needs_review' THEN NEW.organization_type := OLD.organization_type; END IF;
    IF (NEW.organization_type = 'transportation_provider') <> (OLD.account_type = 'provider') THEN NEW.organization_type := OLD.organization_type; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS public.provider_network_profiles (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  business_contact_email text CHECK (business_contact_email IS NULL OR char_length(business_contact_email) <= 254),
  business_contact_phone text CHECK (business_contact_phone IS NULL OR char_length(business_contact_phone) <= 32),
  service_types text[] NOT NULL DEFAULT '{}',
  counties text[] NOT NULL DEFAULT '{}',
  cities text[] NOT NULL DEFAULT '{}',
  zips text[] NOT NULL DEFAULT '{}',
  hours text CHECK (hours IS NULL OR char_length(hours) <= 500),
  medical_delivery boolean NOT NULL DEFAULT false,
  accepting_connections boolean NOT NULL DEFAULT true,
  visible boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_network_profiles TO authenticated;
GRANT ALL ON public.provider_network_profiles TO service_role;
ALTER TABLE public.provider_network_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_provider_workspace_manager(_ws uuid, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = _ws AND w.account_type = 'provider'
      AND public.workspace_role_of(_ws, _uid) IN ('owner','admin')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_provider_workspace_manager(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_provider_workspace_manager(uuid, uuid) TO authenticated;

CREATE POLICY "Provider managers read own network profile" ON public.provider_network_profiles FOR SELECT TO authenticated
  USING (public.is_provider_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "Provider managers insert own network profile" ON public.provider_network_profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_provider_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "Provider managers update own network profile" ON public.provider_network_profiles FOR UPDATE TO authenticated
  USING (public.is_provider_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (public.is_provider_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "Provider managers delete own network profile" ON public.provider_network_profiles FOR DELETE TO authenticated
  USING (public.is_provider_workspace_manager(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_network_profile_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.workspace_id := OLD.workspace_id;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_network_profile_update BEFORE UPDATE ON public.provider_network_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_network_profile_update();

CREATE OR REPLACE FUNCTION public.guard_network_profile_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_network_profile_insert BEFORE INSERT ON public.provider_network_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_network_profile_insert();

CREATE TABLE IF NOT EXISTS public.saved_network_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  provider_workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_workspace_id)
);
CREATE INDEX IF NOT EXISTS saved_network_providers_user_idx ON public.saved_network_providers(user_id);
GRANT SELECT, INSERT, DELETE ON public.saved_network_providers TO authenticated;
GRANT ALL ON public.saved_network_providers TO service_role;
ALTER TABLE public.saved_network_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved providers" ON public.saved_network_providers FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_saved_provider_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_saved_provider_insert BEFORE INSERT ON public.saved_network_providers FOR EACH ROW EXECUTE FUNCTION public.guard_saved_provider_insert();

CREATE OR REPLACE FUNCTION public.list_network_providers(
  _search text DEFAULT NULL, _service_type text DEFAULT NULL, _county text DEFAULT NULL, _city text DEFAULT NULL,
  _zip text DEFAULT NULL, _medical_delivery boolean DEFAULT NULL, _accepting boolean DEFAULT NULL, _saved_only boolean DEFAULT false
) RETURNS TABLE (
  workspace_id uuid, business_name text, mfn_id text, description text, business_contact_email text, business_contact_phone text,
  service_types text[], counties text[], cities text[], zips text[], hours text, medical_delivery boolean, accepting_connections boolean, is_saved boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id, w.display_name, w.mfn_id, p.description, p.business_contact_email, p.business_contact_phone,
    p.service_types, p.counties, p.cities, p.zips, p.hours, p.medical_delivery, p.accepting_connections,
    EXISTS (SELECT 1 FROM public.saved_network_providers s WHERE s.user_id = auth.uid() AND s.provider_workspace_id = w.id)
  FROM public.workspaces w
  JOIN public.provider_network_profiles p ON p.workspace_id = w.id
  WHERE auth.uid() IS NOT NULL
    AND w.account_type = 'provider' AND w.status = 'active' AND w.provider_verified = true AND w.is_test_account = false AND p.visible = true
    AND (_search IS NULL OR _search = '' OR w.display_name ILIKE '%' || _search || '%')
    AND (_service_type IS NULL OR _service_type = '' OR _service_type = ANY (p.service_types))
    AND (_county IS NULL OR _county = '' OR _county = ANY (p.counties))
    AND (_city IS NULL OR _city = '' OR _city = ANY (p.cities))
    AND (_zip IS NULL OR _zip = '' OR _zip = ANY (p.zips))
    AND (_medical_delivery IS NULL OR p.medical_delivery = _medical_delivery)
    AND (_accepting IS NULL OR p.accepting_connections = _accepting)
    AND (_saved_only IS NOT TRUE OR EXISTS (SELECT 1 FROM public.saved_network_providers s WHERE s.user_id = auth.uid() AND s.provider_workspace_id = w.id))
  ORDER BY w.display_name ASC
$$;
REVOKE EXECUTE ON FUNCTION public.list_network_providers(text, text, text, text, text, boolean, boolean, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_network_providers(text, text, text, text, text, boolean, boolean, boolean) TO authenticated;

UPDATE public.workspaces SET provider_verified = true WHERE account_type='provider' AND status='active' AND is_test_account=false;