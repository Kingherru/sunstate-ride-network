
CREATE OR REPLACE FUNCTION public.prevent_billing_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
BEGIN
  IF v_claims IS NOT NULL THEN
    v_role := (v_claims::jsonb ->> 'role');
  END IF;

  -- Backend contexts (no JWT / service_role) may write anything.
  IF v_claims IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.membership_status := 'inactive';
    NEW.membership_tier := 'none';
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
