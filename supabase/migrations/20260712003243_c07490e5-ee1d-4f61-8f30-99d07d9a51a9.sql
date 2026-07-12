
CREATE OR REPLACE FUNCTION public.prevent_member_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service boolean := (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
                        OR current_user = 'service_role';
  is_admin boolean := false;
BEGIN
  -- Service role / server-side callers may change anything
  IF is_service THEN
    RETURN NEW;
  END IF;

  BEGIN
    is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  EXCEPTION WHEN OTHERS THEN
    is_admin := false;
  END;

  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- For regular authenticated users, force protected fields to their previous values
  NEW.membership_status                := OLD.membership_status;
  NEW.membership_tier                  := OLD.membership_tier;
  NEW.medicaid_verified                := OLD.medicaid_verified;
  NEW.medicaid_verified_at             := OLD.medicaid_verified_at;
  NEW.allow_live_medicaid_verification := OLD.allow_live_medicaid_verification;
  NEW.stripe_customer_id               := OLD.stripe_customer_id;
  NEW.stripe_subscription_id           := OLD.stripe_subscription_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_profile_privilege_escalation ON public.member_profiles;
CREATE TRIGGER trg_prevent_member_profile_privilege_escalation
BEFORE UPDATE ON public.member_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_member_profile_privilege_escalation();
