
CREATE OR REPLACE FUNCTION public.prevent_member_profile_privileged_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_derived_zone uuid;
BEGIN
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.is_ops_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
    RAISE EXCEPTION 'membership_status can only be changed by staff';
  END IF;
  IF NEW.membership_tier IS DISTINCT FROM OLD.membership_tier THEN
    RAISE EXCEPTION 'membership_tier can only be changed by staff';
  END IF;
  IF NEW.medicaid_verified IS DISTINCT FROM OLD.medicaid_verified THEN
    RAISE EXCEPTION 'medicaid_verified can only be changed by staff';
  END IF;
  IF NEW.medicaid_verified_at IS DISTINCT FROM OLD.medicaid_verified_at THEN
    RAISE EXCEPTION 'medicaid_verified_at can only be changed by staff';
  END IF;
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'stripe_customer_id can only be changed by staff';
  END IF;
  IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'stripe_subscription_id can only be changed by staff';
  END IF;
  IF NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
    RAISE EXCEPTION 'current_period_end can only be changed by staff';
  END IF;
  IF NEW.display_id IS DISTINCT FROM OLD.display_id THEN
    RAISE EXCEPTION 'display_id can only be changed by staff';
  END IF;
  IF NEW.auto_upgraded_to_facility_at IS DISTINCT FROM OLD.auto_upgraded_to_facility_at THEN
    RAISE EXCEPTION 'auto_upgraded_to_facility_at can only be changed by staff';
  END IF;

  -- Allow the user to change dispatch_zone_id as long as it matches the zone
  -- derived from their postal_code (or is being cleared alongside no postal_code).
  IF NEW.dispatch_zone_id IS DISTINCT FROM OLD.dispatch_zone_id THEN
    v_derived_zone := NULL;
    IF NEW.postal_code IS NOT NULL AND length(trim(NEW.postal_code)) > 0 THEN
      SELECT zone_id INTO v_derived_zone
      FROM public.dispatch_zone_zips
      WHERE zip = trim(NEW.postal_code)
      LIMIT 1;
    END IF;

    IF NEW.dispatch_zone_id IS DISTINCT FROM v_derived_zone THEN
      RAISE EXCEPTION 'dispatch_zone_id can only be changed by staff';
    END IF;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;
