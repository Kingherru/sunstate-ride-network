CREATE TYPE public.workspace_type AS ENUM ('private_pay','facility','hospital','provider');
CREATE TYPE public.workspace_status AS ENUM ('active','pending','suspended');
CREATE TYPE public.workspace_role AS ENUM ('owner','admin','member');
CREATE TYPE public.profile_status AS ENUM ('active','suspended');

CREATE TABLE public.user_profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 120),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 32),
  status public.profile_status NOT NULL DEFAULT 'active',
  legacy_review_needed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile read" ON public.user_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own profile update" ON public.user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type public.workspace_type NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 160),
  status public.workspace_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX ON public.workspace_members(user_id);
GRANT SELECT, UPDATE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.workspace_role_of(_ws uuid, _uid uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members WHERE workspace_id = _ws AND user_id = _uid
$$;
REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) TO authenticated;

CREATE POLICY "Members read workspace" ON public.workspaces FOR SELECT TO authenticated
  USING (public.workspace_role_of(id, auth.uid()) IS NOT NULL);
CREATE POLICY "Owners/admins update workspace" ON public.workspaces FOR UPDATE TO authenticated
  USING (public.workspace_role_of(id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.workspace_role_of(id, auth.uid()) IN ('owner','admin'));
CREATE POLICY "Members read memberships" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IS NOT NULL);

-- Protect server-controlled fields from client edits
CREATE OR REPLACE FUNCTION public.guard_user_profile_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.user_id := OLD.user_id; NEW.status := OLD.status;
    NEW.legacy_review_needed := OLD.legacy_review_needed; NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER guard_user_profile_update BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_update();

CREATE OR REPLACE FUNCTION public.guard_workspace_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.id := OLD.id; NEW.account_type := OLD.account_type; NEW.status := OLD.status;
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER guard_workspace_update BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_update();

-- Atomic setup: profile + (optional) workspace + owner membership, from the
-- caller's own signup metadata. Never assigns a type to legacy users.
CREATE OR REPLACE FUNCTION public.complete_account_setup()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _meta jsonb; _confirmed timestamptz; _type text; _org text; _name text; _phone text;
  _ws uuid; _status public.workspace_status;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT raw_user_meta_data, email_confirmed_at INTO _meta, _confirmed FROM auth.users WHERE id = _uid;
  IF _confirmed IS NULL THEN RAISE EXCEPTION 'email_not_verified'; END IF;
  _type := _meta->>'account_type';
  _name := left(btrim(coalesce(_meta->>'display_name', _meta->>'full_name', '')), 120);
  _phone := left(nullif(btrim(coalesce(_meta->>'phone','')), ''), 32);
  _org := left(btrim(coalesce(_meta->>'organization_name','')), 160);

  INSERT INTO public.user_profiles(user_id, display_name, phone, legacy_review_needed)
  VALUES (_uid, _name, _phone, _type IS NULL)
  ON CONFLICT (user_id) DO NOTHING;

  IF _type IS NULL OR _type NOT IN ('private_pay','facility','hospital','provider') THEN
    RETURN jsonb_build_object('workspace_id', NULL);
  END IF;
  SELECT m.workspace_id INTO _ws FROM public.workspace_members m WHERE m.user_id = _uid AND m.role = 'owner' LIMIT 1;
  IF _ws IS NOT NULL THEN RETURN jsonb_build_object('workspace_id', _ws); END IF;

  IF _type <> 'private_pay' AND _org = '' THEN RAISE EXCEPTION 'organization_required'; END IF;
  _status := CASE WHEN _type = 'private_pay' THEN 'active' ELSE 'pending' END;
  INSERT INTO public.workspaces(account_type, display_name, status, created_by)
  VALUES (_type::public.workspace_type, CASE WHEN _type = 'private_pay' THEN coalesce(nullif(_name,''),'Private Pay') ELSE _org END, _status, _uid)
  RETURNING id INTO _ws;
  INSERT INTO public.workspace_members(workspace_id, user_id, role) VALUES (_ws, _uid, 'owner');
  UPDATE public.user_profiles SET legacy_review_needed = false WHERE user_id = _uid;
  RETURN jsonb_build_object('workspace_id', _ws);
END $$;
REVOKE EXECUTE ON FUNCTION public.complete_account_setup() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.complete_account_setup() TO authenticated;

-- Server-verified access summary used for routing.
CREATE OR REPLACE FUNCTION public.my_access_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'is_admin', public.has_role(auth.uid(), 'admin'),
    'profile_status', (SELECT status FROM public.user_profiles WHERE user_id = auth.uid()),
    'has_profile', EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid()),
    'pending_type', (SELECT raw_user_meta_data->>'account_type' FROM auth.users WHERE id = auth.uid()),
    'workspaces', coalesce((SELECT jsonb_agg(jsonb_build_object('id', w.id, 'type', w.account_type, 'status', w.status, 'role', m.role))
       FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id WHERE m.user_id = auth.uid()), '[]'::jsonb)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.my_access_state() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_access_state() TO authenticated;