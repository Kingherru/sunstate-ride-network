-- 1. Membership defaults for brand-new members: Free / active
ALTER TABLE public.member_profiles
  ALTER COLUMN membership_tier SET DEFAULT 'free'::membership_tier,
  ALTER COLUMN membership_status SET DEFAULT 'active';

-- 2. The billing self-edit guard silently reverted membership changes for
--    EVERY jwt caller, including admins acting through admin_set_membership.
CREATE OR REPLACE FUNCTION public.prevent_billing_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
  v_is_staff boolean := false;
BEGIN
  IF v_claims IS NOT NULL THEN
    v_role := (v_claims::jsonb ->> 'role');
  END IF;

  -- Backend contexts (no JWT / service_role) may write anything.
  IF v_claims IS NULL OR v_role = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_is_staff := public.has_role(auth.uid(), 'admin'::app_role)
               OR public.is_ops_staff(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    v_is_staff := false;
  END;

  -- Admins / ops staff may set membership manually (audited elsewhere).
  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.membership_status := 'active';
    NEW.membership_tier := 'free'::membership_tier;
    NEW.stripe_customer_id := NULL;
    NEW.stripe_subscription_id := NULL;
    NEW.current_period_end := NULL;
    NEW.medicaid_verified := false;
    NEW.auto_upgraded_to_facility_at := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: revert any attempt to change system-managed fields.
  NEW.membership_status := OLD.membership_status;
  NEW.membership_tier := OLD.membership_tier;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.current_period_end := OLD.current_period_end;
  NEW.medicaid_verified := OLD.medicaid_verified;
  NEW.auto_upgraded_to_facility_at := OLD.auto_upgraded_to_facility_at;
  RETURN NEW;
END;
$$;

-- Drop the duplicate trigger (same function bound twice).
DROP TRIGGER IF EXISTS prevent_billing_self_edit_trg ON public.member_profiles;

-- 3. Automatic Free -> Paid on a successful membership payment, and back
--    down when the subscription lapses.
CREATE OR REPLACE FUNCTION public.sync_membership_from_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier membership_tier;
  v_status text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('active', 'trialing') THEN
    v_tier := 'paid'::membership_tier;
    v_status := 'active';
  ELSIF NEW.status = 'past_due' THEN
    v_tier := 'paid'::membership_tier;
    v_status := 'past_due';
  ELSIF NEW.status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    v_tier := 'free'::membership_tier;
    v_status := 'active';
  ELSE
    RETURN NEW; -- incomplete / paused: leave membership untouched
  END IF;

  UPDATE public.member_profiles
     SET membership_tier = v_tier,
         membership_status = v_status,
         stripe_subscription_id = COALESCE(NEW.stripe_subscription_id, stripe_subscription_id),
         stripe_customer_id = COALESCE(NEW.stripe_customer_id, stripe_customer_id),
         current_period_end = COALESCE(NEW.current_period_end, current_period_end),
         updated_at = now()
   WHERE user_id = NEW.user_id
     AND (membership_tier IS DISTINCT FROM v_tier OR membership_status IS DISTINCT FROM v_status);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_membership_from_subscription ON public.subscriptions;
CREATE TRIGGER trg_sync_membership_from_subscription
AFTER INSERT OR UPDATE OF status ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_membership_from_subscription();

REVOKE ALL ON FUNCTION public.sync_membership_from_subscription() FROM PUBLIC, anon, authenticated;