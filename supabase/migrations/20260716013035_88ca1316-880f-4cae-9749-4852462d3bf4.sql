-- Enforce Soft Access rule server-side: a provider that is not an
-- approved provider cannot be set as the assignee of a trip (i.e. cannot
-- "receive" a referral). Self-assignment on your own trip (created_by =
-- assigned_to), unsetting, or admin/service action is still allowed.

CREATE OR REPLACE FUNCTION public.enforce_assigned_provider_is_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nothing to check when assignment is being cleared or unchanged.
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Self-assignment on your own trip is fine (facility/patient/provider
  -- routing a trip to themselves as the operator).
  IF NEW.created_by IS NOT NULL AND NEW.assigned_to = NEW.created_by THEN
    RETURN NEW;
  END IF;

  -- Admins / ops staff can assign anyone (dispatch flow).
  IF auth.uid() IS NOT NULL AND public.is_ops_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Otherwise the assignee must be an approved provider.
  IF NOT public.is_approved_provider(NEW.assigned_to) THEN
    RAISE EXCEPTION 'Trips can only be assigned to approved providers (soft-access providers cannot receive referrals)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_assigned_provider_is_approved ON public.trips;
CREATE TRIGGER trg_enforce_assigned_provider_is_approved
BEFORE INSERT OR UPDATE OF assigned_to ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.enforce_assigned_provider_is_approved();
