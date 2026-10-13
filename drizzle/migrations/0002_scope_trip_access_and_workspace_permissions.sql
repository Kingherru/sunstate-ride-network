-- 1. Minimal member permission flags (default: no workspace-wide access)
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS can_create_requests boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_workspace_requests boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_contractor boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.workspace_members.is_contractor IS 'Business-relationship/permission marker only; not a legal worker classification.';

CREATE OR REPLACE FUNCTION public.can_view_workspace_requests(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _workspace_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members m
    JOIN public.workspaces w ON w.id = m.workspace_id
    WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id AND w.status = 'active'
      AND (m.role IN ('owner','admin') OR (m.can_view_workspace_requests AND NOT m.is_contractor))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_create_workspace_requests(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _workspace_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members m
    JOIN public.workspaces w ON w.id = m.workspace_id
    WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id AND w.status = 'active'
      AND (m.role IN ('owner','admin') OR m.can_create_requests)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_trip_via_workspace(_user_id uuid, _ride_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _ride_request_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ride_requests r
    WHERE r.id = _ride_request_id AND public.can_view_workspace_requests(_user_id, r.workspace_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_active_transport_workspace(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = _user_id AND w.status = 'active'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_workspace_requests(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_create_workspace_requests(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_trip_via_workspace(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_transport_workspace(uuid) FROM anon;

-- 2. ride_requests: workspace viewing uses the new permission function
DROP POLICY IF EXISTS "Workspace owners and admins can view workspace requests" ON public.ride_requests;
CREATE POLICY "Authorized workspace members can view workspace requests" ON public.ride_requests
  FOR SELECT TO authenticated USING (public.can_view_workspace_requests(auth.uid(), workspace_id));

-- 3. trips: remove role-title-only statewide/zone access; default deny
REVOKE ALL ON public.trips FROM anon;
DROP POLICY IF EXISTS "dispatchers view all trips" ON public.trips;
DROP POLICY IF EXISTS "dispatchers update active trips" ON public.trips;
DROP POLICY IF EXISTS "zone managers view zone trips" ON public.trips;
DROP POLICY IF EXISTS "zone managers update zone trips" ON public.trips;

CREATE POLICY "Authorized workspace members can view workspace trips" ON public.trips
  FOR SELECT TO authenticated USING (public.can_view_trip_via_workspace(auth.uid(), ride_request_id));

DROP POLICY IF EXISTS "Signed in users can create trips" ON public.trips;
CREATE POLICY "Workspace users can create trips" ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND assigned_to IS NULL AND public.has_active_transport_workspace(auth.uid()));

-- 4. Medical Delivery stays in ride_requests (no passenger-trip promotion)
CREATE OR REPLACE FUNCTION public.trg_promote_ride_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.trip_kind = 'medical_delivery' OR NEW.transport_type = 'delivery' THEN
    RETURN NEW;
  END IF;
  PERFORM public.promote_ride_request_to_trip(NEW.id);
  RETURN NEW;
END $$;
