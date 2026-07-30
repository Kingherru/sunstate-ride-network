CREATE OR REPLACE FUNCTION public.is_eligible_transport_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.member_profiles mp
      LEFT JOIN public.provider_applications pa ON pa.id = mp.provider_application_id
     WHERE mp.user_id = _user_id
       AND mp.membership_status = 'active'
       AND coalesce(pa.status, 'approved') NOT IN ('denied', 'rejected')
       AND coalesce(pa.compliance_status, 'approved') <> 'denied'
       -- Facility accounts request trips, they do not perform them
       AND mp.auto_upgraded_to_facility_at IS NULL
       -- Platform staff accounts are never dispatchable providers
       AND NOT public.has_any_role(
             _user_id,
             ARRAY['admin','staff','app_manager','zone_manager','dispatcher']::app_role[]
           )
  )
  AND public.provider_has_valid_credentials(_user_id);
$$;

REVOKE ALL ON FUNCTION public.is_eligible_transport_provider(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_eligible_transport_provider(uuid) TO authenticated, service_role;

-- Dispatcher suggestion list: restrict candidate pool to eligible providers
CREATE OR REPLACE FUNCTION public.suggest_providers_for_trip(_trip_id uuid)
 RETURNS TABLE(provider_user_id uuid, display_id text, company_name text, score numeric, rating_score numeric, price_score numeric, area_score numeric, vehicle_score numeric, fairness_score numeric, fleet_score numeric, affinity_score numeric, affinity_active boolean, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
  last_prov uuid;
BEGIN
  IF NOT public.is_ops_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO t FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT provider_user_id INTO last_prov
    FROM public.patient_last_provider
   WHERE first_key = lower(coalesce(t.patient_first_name,''))
     AND last_key  = lower(coalesce(t.patient_last_name,''))
     AND dob_key IS NOT DISTINCT FROM t.patient_date_of_birth
   LIMIT 1;

  RETURN QUERY
  WITH provs AS (
    SELECT mp.user_id,
           mp.display_id,
           mp.company_name,
           coalesce(mp.preferred_zip_codes, ARRAY[]::text[]) AS zips,
           coalesce(mp.long_distance_ok, false) AS long_ok
      FROM public.member_profiles mp
     WHERE public.is_eligible_transport_provider(mp.user_id)
  ),
  ratings AS (
    SELECT provider_user_id, avg(stars)::numeric AS avg_rating, count(*) AS n
      FROM public.provider_ratings GROUP BY provider_user_id
  ),
  fleet AS (
    SELECT owner_id AS provider_user_id,
           count(*) FILTER (WHERE status = 'active') AS n_vehicles,
           bool_or(coalesce(wheelchair_accessible, false)) AS has_wc,
           bool_or(coalesce(stretcher_capable, false))     AS has_stretcher
      FROM public.vehicles GROUP BY owner_id
  ),
  recent AS (
    SELECT assigned_to AS provider_user_id, count(*) AS n_recent
      FROM public.trips
     WHERE assigned_to IS NOT NULL
       AND created_at > now() - interval '14 days'
     GROUP BY assigned_to
  ),
  pricing AS (
    SELECT provider_user_id, avg(base_rate_cents)::numeric AS avg_base
      FROM public.provider_pricing GROUP BY provider_user_id
  ),
  max_recent AS (SELECT greatest(1, coalesce(max(n_recent),1))::numeric AS m FROM recent),
  max_base   AS (SELECT greatest(1, coalesce(max(avg_base),1))::numeric AS m FROM pricing)
  SELECT
    p.user_id AS provider_user_id,
    p.display_id,
    p.company_name,
    round(
      coalesce(least(5, r.avg_rating),3)/5.0 * 25
      + (1 - least(1, coalesce(pr.avg_base,0)/nullif((SELECT m FROM max_base),0))) * 15
      + (CASE WHEN t.pickup_zip = ANY(p.zips) THEN 1
              WHEN t.estimated_miles IS NOT NULL AND t.estimated_miles < 50 THEN 0.4
              WHEN p.long_ok THEN 0.7 ELSE 0.2 END) * 20
      + (CASE
           WHEN coalesce(t.needs_wheelchair,false) AND coalesce(f.has_wc,false) THEN 1
           WHEN coalesce(t.needs_wheelchair,false) THEN 0
           WHEN coalesce(t.service_level::text,'')='stretcher' AND coalesce(f.has_stretcher,false) THEN 1
           WHEN coalesce(t.service_level::text,'')='stretcher' THEN 0
           ELSE 0.8 END) * 20
      + (1 - least(1, coalesce(re.n_recent,0)/nullif((SELECT m FROM max_recent),0))) * 15
      + (least(1, ln(1 + coalesce(f.n_vehicles,0)) / ln(6)) * 5)
      + (CASE WHEN last_prov IS NOT NULL AND p.user_id = last_prov THEN 1 ELSE 0 END) * 10
    , 2)::numeric AS score,
    round(coalesce(least(5, r.avg_rating),3)/5.0 * 25, 2) AS rating_score,
    round((1 - least(1, coalesce(pr.avg_base,0)/nullif((SELECT m FROM max_base),0))) * 15, 2) AS price_score,
    round((CASE WHEN t.pickup_zip = ANY(p.zips) THEN 1
                WHEN t.estimated_miles IS NOT NULL AND t.estimated_miles < 50 THEN 0.4
                WHEN p.long_ok THEN 0.7 ELSE 0.2 END) * 20, 2) AS area_score,
    round((CASE
             WHEN coalesce(t.needs_wheelchair,false) AND coalesce(f.has_wc,false) THEN 1
             WHEN coalesce(t.needs_wheelchair,false) THEN 0
             WHEN coalesce(t.service_level::text,'')='stretcher' AND coalesce(f.has_stretcher,false) THEN 1
             WHEN coalesce(t.service_level::text,'')='stretcher' THEN 0
             ELSE 0.8 END) * 20, 2) AS vehicle_score,
    round((1 - least(1, coalesce(re.n_recent,0)/nullif((SELECT m FROM max_recent),0))) * 15, 2) AS fairness_score,
    round(least(1, ln(1 + coalesce(f.n_vehicles,0)) / ln(6)) * 5, 2) AS fleet_score,
    (CASE WHEN last_prov IS NOT NULL AND p.user_id = last_prov THEN 10 ELSE 0 END)::numeric AS affinity_score,
    (last_prov IS NOT NULL AND p.user_id = last_prov) AS affinity_active,
    (CASE
       WHEN last_prov IS NOT NULL AND p.user_id = last_prov
         THEN 'Previously transported this patient — 2-hour priority offer applies.'
       WHEN coalesce(t.needs_wheelchair,false) AND NOT coalesce(f.has_wc,false)
         THEN 'No wheelchair-accessible vehicle on file.'
       WHEN coalesce(t.service_level::text,'')='stretcher' AND NOT coalesce(f.has_stretcher,false)
         THEN 'No stretcher-capable vehicle on file.'
       WHEN t.pickup_zip = ANY(p.zips)
         THEN 'Pickup ZIP is inside provider service area.'
       ELSE 'Ranked by balanced score.'
     END) AS reason
  FROM provs p
  LEFT JOIN ratings r  ON r.provider_user_id  = p.user_id
  LEFT JOIN fleet   f  ON f.provider_user_id  = p.user_id
  LEFT JOIN recent  re ON re.provider_user_id = p.user_id
  LEFT JOIN pricing pr ON pr.provider_user_id = p.user_id
  ORDER BY score DESC
  LIMIT 25;
END $function$;

-- Ops-staff list of eligible providers for the Admin reservation push screen
CREATE OR REPLACE FUNCTION public.list_eligible_providers()
RETURNS TABLE(user_id uuid, display_id text, company_name text, city text, region text, phone text, preferred_zip_codes text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ops_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  RETURN QUERY
    SELECT mp.user_id, mp.display_id, mp.company_name, mp.city, mp.region, mp.phone,
           coalesce(mp.preferred_zip_codes, ARRAY[]::text[])
      FROM public.member_profiles mp
     WHERE public.is_eligible_transport_provider(mp.user_id)
     ORDER BY coalesce(mp.company_name, mp.display_id, '');
END $$;

REVOKE ALL ON FUNCTION public.list_eligible_providers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_eligible_providers() TO authenticated, service_role;

-- Auto-dispatch engine uses the same eligibility rule
CREATE OR REPLACE FUNCTION public.rank_auto_providers(_pickup_zip text, _zone_id uuid, _created_by uuid, _needs_wheelchair boolean, _service_level text, _is_medicaid boolean, _exclude uuid[] DEFAULT ARRAY[]::uuid[])
 RETURNS TABLE(user_id uuid, area_rank integer, n_recent bigint, rating numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_zip text := substring(regexp_replace(coalesce(_pickup_zip,''), '\D', '', 'g') FROM 1 FOR 5);
  v_zone uuid := _zone_id;
BEGIN
  IF v_zone IS NULL AND v_zip <> '' THEN
    SELECT z.zone_id INTO v_zone FROM public.dispatch_zone_zips z WHERE z.zip = v_zip;
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT mp.user_id,
           coalesce(mp.preferred_zip_codes, ARRAY[]::text[]) AS zips,
           mp.dispatch_zone_id,
           coalesce(mp.long_distance_ok, false) AS long_ok
      FROM public.member_profiles mp
     WHERE (_created_by IS NULL OR mp.user_id <> _created_by)
       AND NOT (mp.user_id = ANY(coalesce(_exclude, ARRAY[]::uuid[])))
       AND public.is_eligible_transport_provider(mp.user_id)
       AND (NOT coalesce(_is_medicaid, false) OR coalesce(mp.medicaid_verified, false))
       AND (
         NOT coalesce(_is_medicaid, false)
         OR NOT EXISTS (
           SELECT 1 FROM public.provider_applications pa
            WHERE pa.id = mp.provider_application_id
              AND pa.compliance_status IN ('caution','review','denied')
         )
       )
  ),
  fleet AS (
    SELECT v.owner_id,
           bool_or(coalesce(v.wheelchair_accessible,false)) AS has_wc,
           bool_or(coalesce(v.stretcher_capable,false))     AS has_stretcher
      FROM public.vehicles v GROUP BY v.owner_id
  ),
  recent AS (
    SELECT t.assigned_to AS user_id, count(*) AS n_recent
      FROM public.trips t
     WHERE t.assigned_to IS NOT NULL AND t.created_at > now() - interval '14 days'
     GROUP BY t.assigned_to
  ),
  ratings AS (
    SELECT pr.provider_user_id, avg(pr.stars)::numeric AS avg_rating
      FROM public.provider_ratings pr GROUP BY pr.provider_user_id
  ),
  scored AS (
    SELECT e.user_id,
           (CASE WHEN v_zip <> '' AND v_zip = ANY(e.zips) THEN 3
                 WHEN v_zone IS NOT NULL AND e.dispatch_zone_id = v_zone THEN 2
                 WHEN e.long_ok THEN 1
                 ELSE 0 END)::int AS area_rank,
           coalesce(r.n_recent, 0)::bigint AS n_recent,
           coalesce(least(5, ra.avg_rating), 3)::numeric AS rating
      FROM eligible e
      LEFT JOIN fleet f   ON f.owner_id = e.user_id
      LEFT JOIN recent r  ON r.user_id = e.user_id
      LEFT JOIN ratings ra ON ra.provider_user_id = e.user_id
     WHERE (NOT coalesce(_needs_wheelchair, false) OR coalesce(f.has_wc, false))
       AND (coalesce(_service_level,'') <> 'stretcher' OR coalesce(f.has_stretcher, false))
  )
  SELECT s.user_id, s.area_rank, s.n_recent, s.rating
    FROM scored s
   ORDER BY s.area_rank DESC, s.rating DESC, s.n_recent ASC
   LIMIT 25;
END $function$;

-- Hard guard: a trip can only be assigned to an eligible provider
CREATE OR REPLACE FUNCTION public.enforce_assigned_provider_is_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_eligible_transport_provider(NEW.assigned_to) THEN
    RAISE EXCEPTION 'That account is not an approved transportation provider and cannot receive trips';
  END IF;
  RETURN NEW;
END $$;