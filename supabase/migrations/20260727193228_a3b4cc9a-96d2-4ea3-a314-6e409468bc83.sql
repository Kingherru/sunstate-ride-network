CREATE OR REPLACE FUNCTION public.block_member_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_staff boolean := false;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  BEGIN
    is_staff := public.has_role(auth.uid(), 'admin')
             OR public.has_role(auth.uid(), 'staff')
             OR public.has_role(auth.uid(), 'app_manager');
  EXCEPTION WHEN OTHERS THEN
    is_staff := false;
  END;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Providers may set their own referral_fee_amount / referral_fee_type.
  -- Only membership tier/status and Medicaid verification remain privileged.
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
$function$;