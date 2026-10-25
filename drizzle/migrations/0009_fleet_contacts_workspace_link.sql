ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.provider_contacts ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.payers ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS wheelchair_capacity integer;

CREATE OR REPLACE FUNCTION public.stamp_owner_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _ws uuid;
BEGIN
  _owner := CASE WHEN TG_TABLE_NAME = 'payers' THEN NEW.owner_user_id ELSE NEW.owner_id END;
  IF TG_OP = 'UPDATE' THEN NEW.workspace_id := OLD.workspace_id; END IF;
  IF NEW.workspace_id IS NULL AND _owner IS NOT NULL THEN
    SELECT CASE WHEN count(*) = 1 THEN min(m.workspace_id::text)::uuid END INTO _ws
    FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = _owner AND m.status = 'active' AND w.status = 'active';
    NEW.workspace_id := _ws;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stamp_workspace ON public.vehicles;
CREATE TRIGGER stamp_workspace BEFORE INSERT OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.stamp_owner_workspace();
DROP TRIGGER IF EXISTS stamp_workspace ON public.drivers;
CREATE TRIGGER stamp_workspace BEFORE INSERT OR UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.stamp_owner_workspace();
DROP TRIGGER IF EXISTS stamp_workspace ON public.provider_contacts;
CREATE TRIGGER stamp_workspace BEFORE INSERT OR UPDATE ON public.provider_contacts FOR EACH ROW EXECUTE FUNCTION public.stamp_owner_workspace();
DROP TRIGGER IF EXISTS stamp_workspace ON public.payers;
CREATE TRIGGER stamp_workspace BEFORE INSERT OR UPDATE ON public.payers FOR EACH ROW EXECUTE FUNCTION public.stamp_owner_workspace();

COMMENT ON COLUMN public.vehicles.workspace_id IS 'Owning workspace, stamped server-side; access still owner-scoped by RLS.';