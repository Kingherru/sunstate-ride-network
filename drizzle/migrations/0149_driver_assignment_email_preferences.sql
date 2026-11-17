ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS driver_assignment_email_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS assignment_email_enabled boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.set_driver_assignment_email(_workspace uuid, _enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=_workspace AND m.user_id=auth.uid() AND m.role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.workspaces SET driver_assignment_email_enabled=_enabled WHERE id=_workspace;
  RETURN _enabled;
END $$;
REVOKE ALL ON FUNCTION public.set_driver_assignment_email(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_driver_assignment_email(uuid, boolean) TO authenticated;