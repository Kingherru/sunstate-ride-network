
-- Test markers (server-controlled)
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS import_job_id uuid;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS on_behalf_of_user_id uuid;

CREATE OR REPLACE FUNCTION public.protect_test_flag() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') AND NEW.is_test_account IS DISTINCT FROM OLD.is_test_account THEN
    NEW.is_test_account := OLD.is_test_account;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_test_flag BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_test_flag();
CREATE TRIGGER trg_protect_test_flag BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.protect_test_flag();

-- Source: add csv_import, mark test requests automatically
ALTER TABLE public.ride_requests DROP CONSTRAINT IF EXISTS ride_requests_intake_source_check;
ALTER TABLE public.ride_requests ADD CONSTRAINT ride_requests_intake_source_check CHECK (intake_source IS NULL OR intake_source = ANY (ARRAY['platform_public_intake','signed_in_person','admin_on_behalf','csv_import']));

CREATE OR REPLACE FUNCTION public.ride_requests_set_source() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.actor_user_id IS NULL THEN NEW.actor_user_id := auth.uid(); END IF;
  NEW.intake_source := CASE
    WHEN NEW.submitted_via = 'admin' THEN 'admin_on_behalf'
    WHEN NEW.import_job_id IS NOT NULL THEN 'csv_import'
    WHEN NEW.requester_user_id IS NULL THEN 'platform_public_intake'
    ELSE 'signed_in_person' END;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE is_test_account AND user_id IN (NEW.requester_user_id, NEW.actor_user_id, NEW.on_behalf_of_user_id))
     OR EXISTS (SELECT 1 FROM public.workspaces WHERE is_test_account AND id = NEW.workspace_id) THEN
    NEW.is_test := true;
  END IF;
  RETURN NEW;
END $$;

-- Test requests never enter live trips/dispatch
CREATE OR REPLACE FUNCTION public.trg_promote_ride_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_test OR NEW.trip_kind = 'medical_delivery' OR NEW.transport_type = 'delivery' THEN RETURN NEW; END IF;
  PERFORM public.promote_ride_request_to_trip(NEW.id);
  RETURN NEW;
END $$;

-- Admin label alone no longer grants full access: full admin = Master Admin.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    AND (_role <> 'admin' OR EXISTS (SELECT 1 FROM public.platform_master_admin WHERE user_id = _user_id))
$$;
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_master_admin m JOIN public.user_roles r ON r.user_id = m.user_id AND r.role = 'admin' WHERE m.user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.holds_admin_label(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

-- Permissions
CREATE TABLE public.admin_permissions (
  user_id uuid PRIMARY KEY,
  preset text NOT NULL DEFAULT 'none' CHECK (preset IN ('none','support','operations','finance','custom')),
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope text NOT NULL DEFAULT 'none' CHECK (scope IN ('none','selected','all')),
  active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or master read" ON public.admin_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_master_admin(auth.uid()));
CREATE POLICY "master writes" ON public.admin_permissions FOR ALL TO authenticated USING (public.is_master_admin(auth.uid()) AND user_id <> auth.uid()) WITH CHECK (public.is_master_admin(auth.uid()) AND user_id <> auth.uid());

CREATE TABLE public.admin_permission_scopes (
  admin_user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, workspace_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permission_scopes TO authenticated;
GRANT ALL ON public.admin_permission_scopes TO service_role;
ALTER TABLE public.admin_permission_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or master read" ON public.admin_permission_scopes FOR SELECT TO authenticated USING (admin_user_id = auth.uid() OR public.is_master_admin(auth.uid()));
CREATE POLICY "master writes" ON public.admin_permission_scopes FOR ALL TO authenticated USING (public.is_master_admin(auth.uid()) AND admin_user_id <> auth.uid()) WITH CHECK (public.is_master_admin(auth.uid()) AND admin_user_id <> auth.uid());

CREATE OR REPLACE FUNCTION public.block_master_permission_row() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.platform_master_admin WHERE user_id = NEW.user_id) THEN RAISE EXCEPTION 'master_admin_has_no_permission_row'; END IF;
  NEW.updated_at := now(); NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_block_master_perm BEFORE INSERT OR UPDATE ON public.admin_permissions FOR EACH ROW EXECUTE FUNCTION public.block_master_permission_row();

CREATE OR REPLACE FUNCTION public.audit_admin_permissions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'admin_permissions' THEN
    INSERT INTO public.staff_audit_log(actor_user_id, action, target_kind, target_id, metadata)
    VALUES (auth.uid(), 'admin_permissions_' || lower(TG_OP), 'admin', coalesce(NEW.user_id, OLD.user_id)::text,
      jsonb_build_object('previous', CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('preset',OLD.preset,'sections',OLD.sections,'scope',OLD.scope,'active',OLD.active) END,
                         'new', CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('preset',NEW.preset,'sections',NEW.sections,'scope',NEW.scope,'active',NEW.active) END));
  ELSE
    INSERT INTO public.staff_audit_log(actor_user_id, action, target_kind, target_id, metadata)
    VALUES (auth.uid(), 'admin_scope_' || lower(TG_OP), 'admin', coalesce(NEW.admin_user_id, OLD.admin_user_id)::text,
      jsonb_build_object('workspace_id', coalesce(NEW.workspace_id, OLD.workspace_id)));
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_audit_admin_permissions AFTER INSERT OR UPDATE OR DELETE ON public.admin_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_admin_permissions();
CREATE TRIGGER trg_audit_admin_scopes AFTER INSERT OR DELETE ON public.admin_permission_scopes FOR EACH ROW EXECUTE FUNCTION public.audit_admin_permissions();

-- Server-side checks (caller = auth.uid())
CREATE OR REPLACE FUNCTION public.admin_can(_section text, _level text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_master_admin(auth.uid()) OR (
    public.holds_admin_label(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.admin_permissions p WHERE p.user_id = auth.uid() AND p.active
        AND CASE WHEN _level = 'read' THEN (p.sections->>_section) IN ('read','manage') ELSE (p.sections->>_section) = 'manage' END))
$$;
CREATE OR REPLACE FUNCTION public.admin_can_account(_workspace_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_master_admin(auth.uid()) OR (
    public.holds_admin_label(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.admin_permissions p WHERE p.user_id = auth.uid() AND p.active
        AND (p.scope = 'all' OR (p.scope = 'selected' AND _workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.admin_permission_scopes s WHERE s.admin_user_id = auth.uid() AND s.workspace_id = _workspace_id)))))
$$;
GRANT EXECUTE ON FUNCTION public.admin_can(text,text), public.admin_can_account(uuid), public.holds_admin_label(uuid) TO authenticated;

CREATE POLICY "Scoped admins view requests" ON public.ride_requests FOR SELECT TO authenticated
  USING (public.admin_can('requests','read') AND public.admin_can_account(workspace_id));
CREATE POLICY "Scoped admins view trips" ON public.trips FOR SELECT TO authenticated
  USING (public.admin_can('requests','read') AND EXISTS (SELECT 1 FROM public.ride_requests r WHERE r.id = trips.ride_request_id AND public.admin_can_account(r.workspace_id)));

-- Access state: admin label vs master
CREATE OR REPLACE FUNCTION public.my_access_state() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'is_admin', public.holds_admin_label(auth.uid()),
    'is_master_admin', public.is_master_admin(auth.uid()),
    'admin_permissions', (SELECT jsonb_build_object('preset',preset,'sections',sections,'scope',scope,'active',active) FROM public.admin_permissions WHERE user_id = auth.uid()),
    'is_test_account', coalesce((SELECT is_test_account FROM public.user_profiles WHERE user_id = auth.uid()), false),
    'profile_status', (SELECT status FROM public.user_profiles WHERE user_id = auth.uid()),
    'has_profile', EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid()),
    'mfn_id', (SELECT mfn_id FROM public.user_profiles WHERE user_id = auth.uid()),
    'display_name', (SELECT display_name FROM public.user_profiles WHERE user_id = auth.uid()),
    'pending_type', (SELECT raw_user_meta_data->>'account_type' FROM auth.users WHERE id = auth.uid()),
    'workspaces', coalesce((SELECT jsonb_agg(jsonb_build_object('id', w.id, 'type', w.account_type, 'status', w.status, 'role', m.role,
          'name', w.display_name, 'mfn_id', w.mfn_id, 'organization_type', w.organization_type, 'is_contractor', m.is_contractor) ORDER BY w.created_at)
       FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id WHERE m.user_id = auth.uid()), '[]'::jsonb)
  )
$$;

-- CSV import jobs (no raw CSV stored; only counts + idempotency key)
CREATE TABLE public.csv_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('passenger','delivery')),
  idempotency_key text NOT NULL,
  total_rows int NOT NULL DEFAULT 0,
  submitted_rows int NOT NULL DEFAULT 0,
  failed_rows int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
GRANT SELECT ON public.csv_import_jobs TO authenticated;
GRANT ALL ON public.csv_import_jobs TO service_role;
ALTER TABLE public.csv_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own imports read" ON public.csv_import_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE UNIQUE INDEX IF NOT EXISTS ride_requests_import_row_uniq ON public.ride_requests (import_job_id, (coalesce(special_instructions,'')), pickup_date, pickup_time, pickup_address, patient_last_name) WHERE import_job_id IS NOT NULL;
