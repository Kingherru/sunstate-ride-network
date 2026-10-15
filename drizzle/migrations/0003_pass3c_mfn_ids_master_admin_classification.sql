
-- ===== Permanent MFN IDs (non-PII, server-generated, immutable) =====
CREATE SEQUENCE IF NOT EXISTS public.mfn_person_seq START 100001;
CREATE SEQUENCE IF NOT EXISTS public.mfn_account_seq START 100001;
CREATE SEQUENCE IF NOT EXISTS public.mfn_request_seq START 100001;

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS mfn_id text;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS mfn_id text;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS organization_type text NOT NULL DEFAULT 'needs_review';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS legacy_backfilled boolean NOT NULL DEFAULT false;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS mfn_id text;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS actor_user_id uuid;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS intake_source text;

ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_organization_type_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_organization_type_check CHECK (organization_type IN
 ('needs_review','private_pay_patient','general_facility','medical_facility','hospital','broker','insurance_company','group_home','nursing_home','medical_courier','other_organization','transportation_provider'));
ALTER TABLE public.ride_requests DROP CONSTRAINT IF EXISTS ride_requests_intake_source_check;
ALTER TABLE public.ride_requests ADD CONSTRAINT ride_requests_intake_source_check CHECK (intake_source IS NULL OR intake_source IN ('platform_public_intake','signed_in_person','admin_on_behalf'));

CREATE OR REPLACE FUNCTION public.mfn_assign_id() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.mfn_id := CASE TG_ARGV[0]
      WHEN 'person'  THEN 'MFN-P-' || nextval('public.mfn_person_seq')
      WHEN 'account' THEN 'MFN-A-' || nextval('public.mfn_account_seq')
      ELSE 'MFN-R-' || nextval('public.mfn_request_seq') END;
  ELSIF NEW.mfn_id IS DISTINCT FROM OLD.mfn_id THEN
    IF OLD.mfn_id IS NOT NULL THEN RAISE EXCEPTION 'mfn_id_immutable'; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mfn_id ON public.user_profiles;
CREATE TRIGGER trg_mfn_id BEFORE INSERT OR UPDATE OF mfn_id ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.mfn_assign_id('person');
DROP TRIGGER IF EXISTS trg_mfn_id ON public.workspaces;
CREATE TRIGGER trg_mfn_id BEFORE INSERT OR UPDATE OF mfn_id ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.mfn_assign_id('account');
DROP TRIGGER IF EXISTS trg_mfn_id ON public.ride_requests;
CREATE TRIGGER trg_mfn_id BEFORE INSERT OR UPDATE OF mfn_id ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.mfn_assign_id('request');

-- Request source attribution, resolved in the database (never trusted from the browser)
CREATE OR REPLACE FUNCTION public.ride_requests_set_source() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.actor_user_id IS NULL THEN NEW.actor_user_id := auth.uid(); END IF;
  NEW.intake_source := CASE
    WHEN NEW.submitted_via = 'admin' THEN 'admin_on_behalf'
    WHEN NEW.requester_user_id IS NULL THEN 'platform_public_intake'
    ELSE 'signed_in_person' END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ride_requests_set_source ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_set_source BEFORE INSERT ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.ride_requests_set_source();

-- Backfill: profiles for every existing sign-in (IDs preserved), then MFN IDs.
INSERT INTO public.user_profiles(user_id, display_name, legacy_review_needed)
SELECT u.id, '', true FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id);

UPDATE public.user_profiles SET mfn_id = 'MFN-P-' || nextval('public.mfn_person_seq') WHERE mfn_id IS NULL;
UPDATE public.workspaces SET mfn_id = 'MFN-A-' || nextval('public.mfn_account_seq') WHERE mfn_id IS NULL;
UPDATE public.ride_requests SET mfn_id = 'MFN-R-' || nextval('public.mfn_request_seq') WHERE mfn_id IS NULL;
UPDATE public.ride_requests SET intake_source = CASE WHEN requester_user_id IS NULL THEN 'platform_public_intake' ELSE 'signed_in_person' END WHERE intake_source IS NULL;

-- Legacy continuity: link only clearly identifiable older accounts.
-- Patient (PAT) records → Private Pay. Provider (FLNP) records with a company name AND owned vehicles or drivers → Provider.
DO $$
DECLARE r record; _ws uuid; _type public.workspace_type; _org text; _status public.workspace_status;
BEGIN
  FOR r IN
    SELECT m.user_id, m.display_id, m.company_name FROM public.member_profiles m
    WHERE m.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.user_id = m.user_id)
      AND NOT public.has_role(m.user_id, 'admin')
  LOOP
    _type := NULL;
    IF r.display_id LIKE 'PAT-%' THEN
      _type := 'private_pay'; _org := 'private_pay_patient'; _status := 'active';
    ELSIF r.display_id LIKE 'FLNP-%' AND coalesce(btrim(r.company_name),'') <> ''
      AND (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.owner_id = r.user_id) OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.owner_id = r.user_id)) THEN
      _type := 'provider'; _org := 'transportation_provider';
      _status := CASE WHEN public.is_approved_provider(r.user_id) THEN 'active' ELSE 'pending' END;
    END IF;
    IF _type IS NOT NULL THEN
      INSERT INTO public.workspaces(account_type, display_name, status, created_by, organization_type, legacy_backfilled)
      VALUES (_type, CASE WHEN _type = 'provider' THEN left(btrim(r.company_name),160) ELSE 'Private Pay' END, _status, r.user_id, _org, true)
      RETURNING id INTO _ws;
      INSERT INTO public.workspace_members(workspace_id, user_id, role) VALUES (_ws, r.user_id, 'owner');
      UPDATE public.user_profiles SET legacy_review_needed = false WHERE user_id = r.user_id;
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_mfn_id_key ON public.user_profiles(mfn_id);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_mfn_id_key ON public.workspaces(mfn_id);
CREATE UNIQUE INDEX IF NOT EXISTS ride_requests_mfn_id_key ON public.ride_requests(mfn_id);

-- ===== Account classification audit (business label only; never a permission) =====
CREATE TABLE IF NOT EXISTS public.workspace_classification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  changed_by uuid,
  old_type text, new_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workspace_classification_log TO authenticated;
GRANT ALL ON public.workspace_classification_log TO service_role;
ALTER TABLE public.workspace_classification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members and admins read classification history" ON public.workspace_classification_log FOR SELECT TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.log_workspace_classification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_type IS DISTINCT FROM OLD.organization_type THEN
    INSERT INTO public.workspace_classification_log(workspace_id, changed_by, old_type, new_type)
    VALUES (NEW.id, auth.uid(), OLD.organization_type, NEW.organization_type);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_workspace_classification ON public.workspaces;
CREATE TRIGGER trg_log_workspace_classification AFTER UPDATE OF organization_type ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.log_workspace_classification();

-- Signed-in users may not set mfn_id/legacy flags; organization_type stays editable by owners/admins (label only).
CREATE OR REPLACE FUNCTION public.guard_workspace_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.id := OLD.id; NEW.account_type := OLD.account_type; NEW.status := OLD.status;
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    NEW.legacy_backfilled := OLD.legacy_backfilled;
    IF NEW.organization_type = 'needs_review' AND OLD.organization_type <> 'needs_review' THEN NEW.organization_type := OLD.organization_type; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ===== Master Admin (single protected owner) =====
CREATE TABLE IF NOT EXISTS public.platform_master_admin (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id uuid NOT NULL UNIQUE,
  designated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_master_admin TO authenticated;
GRANT ALL ON public.platform_master_admin TO service_role;
ALTER TABLE public.platform_master_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read master admin" ON public.platform_master_admin FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Designate only when exactly one verified admin exists.
INSERT INTO public.platform_master_admin(user_id)
SELECT r.user_id FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
WHERE r.role = 'admin' AND u.email_confirmed_at IS NOT NULL
  AND (SELECT count(*) FROM public.user_roles r2 JOIN auth.users u2 ON u2.id = r2.user_id WHERE r2.role='admin' AND u2.email_confirmed_at IS NOT NULL) = 1
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_master_admin WHERE user_id = _user_id) AND public.has_role(_user_id,'admin')
$$;

-- Only the Master Admin may grant/remove admin roles; nobody signed in may alter the Master Admin's admin role.
DROP POLICY IF EXISTS "admins manage all roles" ON public.user_roles;
CREATE POLICY "master admin manages all roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_master_admin(auth.uid())) WITH CHECK (public.is_master_admin(auth.uid()));
CREATE POLICY "admins manage non-admin roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND role <> 'admin') WITH CHECK (public.has_role(auth.uid(),'admin') AND role <> 'admin');

CREATE OR REPLACE FUNCTION public.protect_master_admin_role() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND OLD.role = 'admin'
     AND EXISTS (SELECT 1 FROM public.platform_master_admin m WHERE m.user_id = OLD.user_id) THEN
    RAISE EXCEPTION 'master_admin_protected';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_protect_master_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_master_admin_role BEFORE UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.protect_master_admin_role();

-- Audit every role change.
CREATE OR REPLACE FUNCTION public.audit_user_roles() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.staff_audit_log(actor_user_id, action, target_kind, target_id, metadata)
  VALUES (auth.uid(), 'role_' || lower(TG_OP), 'user', coalesce(NEW.user_id, OLD.user_id)::text,
          jsonb_build_object('role', coalesce(NEW.role, OLD.role)));
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles();

-- Access summary now includes MFN ID, name, master flag and account labels.
CREATE OR REPLACE FUNCTION public.my_access_state() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'is_admin', public.has_role(auth.uid(), 'admin'),
    'is_master_admin', public.is_master_admin(auth.uid()),
    'profile_status', (SELECT status FROM public.user_profiles WHERE user_id = auth.uid()),
    'has_profile', EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid()),
    'mfn_id', (SELECT mfn_id FROM public.user_profiles WHERE user_id = auth.uid()),
    'display_name', (SELECT display_name FROM public.user_profiles WHERE user_id = auth.uid()),
    'pending_type', (SELECT raw_user_meta_data->>'account_type' FROM auth.users WHERE id = auth.uid()),
    'workspaces', coalesce((SELECT jsonb_agg(jsonb_build_object('id', w.id, 'type', w.account_type, 'status', w.status, 'role', m.role,
          'name', w.display_name, 'mfn_id', w.mfn_id, 'organization_type', w.organization_type) ORDER BY w.created_at)
       FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id WHERE m.user_id = auth.uid()), '[]'::jsonb)
  )
$$;
