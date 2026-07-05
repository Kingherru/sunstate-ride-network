
-- Zone manager assignments
CREATE TABLE IF NOT EXISTS public.zone_manager_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.dispatch_zones(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, zone_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zone_manager_assignments TO authenticated;
GRANT ALL ON public.zone_manager_assignments TO service_role;
ALTER TABLE public.zone_manager_assignments ENABLE ROW LEVEL SECURITY;

-- Helper: check any of several roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

-- Helper: does user manage this zone?
CREATE OR REPLACE FUNCTION public.manages_zone(_user_id uuid, _zone_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.zone_manager_assignments
    WHERE user_id = _user_id AND zone_id = _zone_id
  )
$$;

-- Helper: any staff role (for read-mostly checks)
CREATE OR REPLACE FUNCTION public.is_ops_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','staff','app_manager','zone_manager','dispatcher')
  )
$$;

-- RLS for zone_manager_assignments
CREATE POLICY "zone assignments admin/app_manager write" ON public.zone_manager_assignments
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','app_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','app_manager']::app_role[]));

CREATE POLICY "zone managers view own assignments" ON public.zone_manager_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Allow admins & app_managers to manage user_roles (but only admins can grant admin)
CREATE POLICY "admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "app_managers manage non-admin roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'app_manager') AND role <> 'admin'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'app_manager') AND role <> 'admin'
  );

CREATE POLICY "ops staff read roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_ops_staff(auth.uid()));

-- Zone managers & dispatchers can view trips
CREATE POLICY "dispatchers view all trips" ON public.trips
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['dispatcher','app_manager']::app_role[]));

CREATE POLICY "zone managers view zone trips" ON public.trips
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'zone_manager')
    AND dispatch_zone_id IS NOT NULL
    AND public.manages_zone(auth.uid(), dispatch_zone_id)
  );

CREATE POLICY "dispatchers update trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['dispatcher','app_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['dispatcher','app_manager']::app_role[]));

CREATE POLICY "zone managers update zone trips" ON public.trips
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'zone_manager')
    AND dispatch_zone_id IS NOT NULL
    AND public.manages_zone(auth.uid(), dispatch_zone_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'zone_manager')
    AND dispatch_zone_id IS NOT NULL
    AND public.manages_zone(auth.uid(), dispatch_zone_id)
  );

-- Provider applications: zone managers & app managers can view & approve/decline
CREATE POLICY "managers view provider apps" ON public.provider_applications
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['app_manager','zone_manager']::app_role[]));

CREATE POLICY "managers update provider apps" ON public.provider_applications
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['app_manager','zone_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['app_manager','zone_manager']::app_role[]));

-- App managers can manage zones & zip mapping
CREATE POLICY "app_managers manage zones" ON public.dispatch_zones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'app_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'app_manager'));

CREATE POLICY "app_managers manage zone zips" ON public.dispatch_zone_zips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'app_manager'))
  WITH CHECK (public.has_role(auth.uid(), 'app_manager'));
