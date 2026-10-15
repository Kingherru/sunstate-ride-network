
CREATE OR REPLACE FUNCTION public.workspace_default_org_type() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.organization_type IS NULL OR NEW.organization_type = 'needs_review' THEN
    NEW.organization_type := CASE NEW.account_type
      WHEN 'private_pay' THEN 'private_pay_patient'
      WHEN 'hospital' THEN 'hospital'
      WHEN 'provider' THEN 'transportation_provider'
      ELSE 'needs_review' END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_workspace_default_org_type ON public.workspaces;
CREATE TRIGGER trg_workspace_default_org_type BEFORE INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.workspace_default_org_type();

CREATE OR REPLACE FUNCTION public.guard_workspace_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.id := OLD.id; NEW.account_type := OLD.account_type; NEW.status := OLD.status;
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
    NEW.legacy_backfilled := OLD.legacy_backfilled;
    IF NEW.organization_type = 'needs_review' AND OLD.organization_type <> 'needs_review' THEN NEW.organization_type := OLD.organization_type; END IF;
    -- The provider label belongs only to provider accounts and cannot be self-assigned.
    IF (NEW.organization_type = 'transportation_provider') <> (OLD.account_type = 'provider') THEN NEW.organization_type := OLD.organization_type; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
