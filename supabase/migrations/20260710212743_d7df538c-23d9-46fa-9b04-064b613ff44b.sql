
-- 1. provider_embed_tokens: drop anon-readable policy
DROP POLICY IF EXISTS "Anon can read active embed tokens" ON public.provider_embed_tokens;
REVOKE SELECT ON public.provider_embed_tokens FROM anon;

-- 2. member_profiles: drop broad directory browse; add safe view
DROP POLICY IF EXISTS "Active members can browse directory" ON public.member_profiles;

DROP VIEW IF EXISTS public.member_directory;
CREATE VIEW public.member_directory
WITH (security_invoker = true) AS
SELECT
  user_id,
  display_id,
  first_name,
  last_name,
  company_name,
  region,
  city,
  preferred_zip_codes,
  membership_status,
  membership_tier
FROM public.member_profiles
WHERE membership_status = 'active';

GRANT SELECT ON public.member_directory TO authenticated;

CREATE POLICY "Ops staff can view all profiles"
  ON public.member_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_ops_staff(auth.uid()));

-- 3. is_approved_provider(): use stable provider_application_id link
CREATE OR REPLACE FUNCTION public.is_approved_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.member_profiles mp
      JOIN public.provider_applications pa ON pa.id = mp.provider_application_id
     WHERE mp.user_id = _user_id
       AND pa.status = 'approved'
  );
$$;

-- 4. haversine_miles: fix mutable search_path
CREATE OR REPLACE FUNCTION public.haversine_miles(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 3958.8 * 2 * asin(sqrt(
    sin(radians((lat2 - lat1)/2))^2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians((lng2 - lng1)/2))^2
  ));
$$;

-- 5. Revoke PUBLIC EXECUTE on every SECURITY DEFINER function in public schema.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon;',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant EXECUTE to authenticated only for functions actually invoked by
-- signed-in users (as RPCs or as RLS-policy helpers).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ops_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_thread_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manages_zone(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_provider(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_trips(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_message(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provider_covers_pickup(uuid, double precision, double precision, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provider_has_valid_credentials(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_member_display_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_expiring_provider_credentials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trips_admin_metadata() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_staff_action(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.offer_trip_priority(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_priority_offer(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_trip_payment_status(uuid, trip_payment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_direct_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_providers_for_trip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_free_membership(uuid) TO authenticated;
