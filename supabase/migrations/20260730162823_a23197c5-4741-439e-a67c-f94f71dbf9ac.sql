CREATE OR REPLACE FUNCTION public.block_member_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := false;
BEGIN
  -- Trusted backend contexts: service role, or no end-user JWT at all.
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    is_staff := public.has_role(auth.uid(), 'admin'::app_role)
             OR public.is_ops_staff(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    is_staff := false;
  END;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.membership_tier IS DISTINCT FROM OLD.membership_tier
     OR NEW.membership_status IS DISTINCT FROM OLD.membership_status
     OR NEW.medicaid_verified IS DISTINCT FROM OLD.medicaid_verified
     OR NEW.medicaid_verified_at IS DISTINCT FROM OLD.medicaid_verified_at
  THEN
    RAISE EXCEPTION 'Not allowed to modify membership or verification fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;