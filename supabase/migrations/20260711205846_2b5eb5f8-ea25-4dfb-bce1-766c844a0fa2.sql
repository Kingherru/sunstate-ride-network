
-- 1. platform_settings: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated can read platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);

-- 2. member_profiles: block client-side updates to system-managed fields
CREATE OR REPLACE FUNCTION public.prevent_member_profile_privileged_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role and admins/ops staff to update everything
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
  IF NEW.dispatch_zone_id IS DISTINCT FROM OLD.dispatch_zone_id THEN
    RAISE EXCEPTION 'dispatch_zone_id can only be changed by staff';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_member_profile_privileged_updates ON public.member_profiles;
CREATE TRIGGER trg_prevent_member_profile_privileged_updates
BEFORE UPDATE ON public.member_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_member_profile_privileged_updates();

-- 3. ride_requests: tighten claim race - split into two clear policies
DROP POLICY IF EXISTS "Providers can claim open ride requests" ON public.ride_requests;

CREATE POLICY "Providers can claim unassigned ride requests"
ON public.ride_requests
FOR UPDATE
USING (
  public.is_approved_provider(auth.uid())
  AND assigned_provider_id IS NULL
  AND public.provider_covers_pickup(auth.uid(), pickup_lat, pickup_lng, distance_miles)
)
WITH CHECK (
  public.is_approved_provider(auth.uid())
  AND assigned_provider_id = auth.uid()
);

CREATE POLICY "Providers can update their assigned ride requests"
ON public.ride_requests
FOR UPDATE
USING (
  public.is_approved_provider(auth.uid())
  AND assigned_provider_id = auth.uid()
)
WITH CHECK (
  public.is_approved_provider(auth.uid())
  AND assigned_provider_id = auth.uid()
);

-- 4. Revoke anon EXECUTE on privileged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.apply_approved_quote_to_trip() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decide_trip_quote(uuid, boolean, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_ride_request_to_trip(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_staff_thread() FROM anon, PUBLIC;
-- verify_course_certificate is intentionally publicly callable (token-based lookup); leave anon EXECUTE
