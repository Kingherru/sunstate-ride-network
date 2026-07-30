-- Fix the last guard that silently reverted admin/backend membership writes.
CREATE OR REPLACE FUNCTION public.prevent_member_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_service boolean := (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
                        OR current_user = 'service_role'
                        OR auth.uid() IS NULL;
  is_staff boolean := false;
BEGIN
  IF is_service THEN
    RETURN NEW;
  END IF;

  BEGIN
    is_staff := public.has_role(auth.uid(), 'admin'::public.app_role)
             OR public.is_ops_staff(auth.uid());
  EXCEPTION WHEN OTHERS THEN
    is_staff := false;
  END;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  NEW.membership_status                := OLD.membership_status;
  NEW.membership_tier                  := OLD.membership_tier;
  NEW.medicaid_verified                := OLD.medicaid_verified;
  NEW.medicaid_verified_at             := OLD.medicaid_verified_at;
  NEW.allow_live_medicaid_verification := OLD.allow_live_medicaid_verification;
  NEW.stripe_customer_id               := OLD.stripe_customer_id;
  NEW.stripe_subscription_id           := OLD.stripe_subscription_id;

  RETURN NEW;
END;
$function$;

-- ZIP-code based provider search for the facility portal.
CREATE OR REPLACE FUNCTION public.search_providers_by_zip(_zip text)
RETURNS TABLE (
  user_id uuid,
  company_name text,
  first_name text,
  last_name text,
  city text,
  region text,
  phone text,
  dispatch_email text,
  postal_code text,
  service_radius_miles integer,
  long_distance_ok boolean,
  medicaid_verified boolean,
  center_lat double precision,
  center_lng double precision,
  match_type text,
  zone_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_zip text := substring(regexp_replace(coalesce(_zip, ''), '\D', '', 'g') FROM 1 FOR 5);
  v_zone uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_facility_or_provider(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to search providers' USING ERRCODE = '42501';
  END IF;

  IF length(v_zip) <> 5 THEN
    RETURN;
  END IF;

  SELECT z.zone_id INTO v_zone FROM public.dispatch_zone_zips z WHERE z.zip = v_zip LIMIT 1;

  RETURN QUERY
  SELECT mp.user_id,
         mp.company_name,
         mp.first_name,
         mp.last_name,
         mp.city,
         mp.region,
         mp.phone,
         mp.dispatch_email,
         mp.postal_code,
         mp.service_radius_miles,
         coalesce(mp.long_distance_ok, false),
         coalesce(mp.medicaid_verified, false),
         mp.center_lat,
         mp.center_lng,
         (CASE
            WHEN v_zip = ANY(coalesce(mp.preferred_zip_codes, ARRAY[]::text[])) THEN 'zip'
            WHEN mp.postal_code = v_zip THEN 'zip'
            WHEN v_zone IS NOT NULL AND mp.dispatch_zone_id = v_zone THEN 'zone'
            ELSE 'long_distance'
          END)::text AS match_type,
         dz.name::text AS zone_name
    FROM public.member_profiles mp
    LEFT JOIN public.dispatch_zones dz ON dz.id = mp.dispatch_zone_id
   WHERE mp.membership_status = 'active'
     AND mp.user_id <> auth.uid()
     AND public.is_approved_provider(mp.user_id)
     AND (
       v_zip = ANY(coalesce(mp.preferred_zip_codes, ARRAY[]::text[]))
       OR mp.postal_code = v_zip
       OR (v_zone IS NOT NULL AND mp.dispatch_zone_id = v_zone)
       OR coalesce(mp.long_distance_ok, false)
     )
   ORDER BY (CASE
               WHEN v_zip = ANY(coalesce(mp.preferred_zip_codes, ARRAY[]::text[])) OR mp.postal_code = v_zip THEN 0
               WHEN v_zone IS NOT NULL AND mp.dispatch_zone_id = v_zone THEN 1
               ELSE 2
             END),
            coalesce(mp.company_name, mp.last_name, '');
END;
$$;

REVOKE ALL ON FUNCTION public.search_providers_by_zip(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_providers_by_zip(text) TO authenticated;