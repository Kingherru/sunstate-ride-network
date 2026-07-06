
-- 1. Revert zone_zips write policy to admin-only
DROP POLICY IF EXISTS "zone_zips ops write" ON public.dispatch_zone_zips;
CREATE POLICY "zone_zips admin write" ON public.dispatch_zone_zips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Trip priority offer columns
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS priority_offer_provider_id uuid,
  ADD COLUMN IF NOT EXISTS priority_offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority_offer_refused_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority_offer_created_at timestamptz;

-- 3. Patient -> most recent completed provider view
CREATE OR REPLACE VIEW public.patient_last_provider
WITH (security_invoker=on) AS
SELECT DISTINCT ON (lower(coalesce(patient_first_name,'')), lower(coalesce(patient_last_name,'')), patient_date_of_birth)
  lower(coalesce(patient_first_name,'')) AS first_key,
  lower(coalesce(patient_last_name,''))  AS last_key,
  patient_date_of_birth AS dob_key,
  assigned_to AS provider_user_id,
  coalesce(actual_dropoff_at, updated_at) AS last_trip_at
FROM public.trips
WHERE assigned_to IS NOT NULL
  AND status IN ('completed','delivered','closed')
ORDER BY lower(coalesce(patient_first_name,'')),
         lower(coalesce(patient_last_name,'')),
         patient_date_of_birth,
         coalesce(actual_dropoff_at, updated_at) DESC;

-- 4. Fair assignment scoring function
CREATE OR REPLACE FUNCTION public.suggest_providers_for_trip(_trip_id uuid)
RETURNS TABLE(
  provider_user_id uuid,
  display_id text,
  company_name text,
  score numeric,
  rating_score numeric,
  price_score numeric,
  area_score numeric,
  vehicle_score numeric,
  fairness_score numeric,
  fleet_score numeric,
  affinity_score numeric,
  affinity_active boolean,
  reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  last_prov uuid;
BEGIN
  -- Caller must be ops staff
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
     WHERE mp.membership_status = 'active'
       AND public.provider_has_valid_credentials(mp.user_id)
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
    -- weighted composite (0-100)
    round(
      coalesce(least(5, r.avg_rating),3)/5.0 * 25            -- rating 25
      + (1 - least(1, coalesce(pr.avg_base,0)/nullif((SELECT m FROM max_base),0))) * 15  -- price 15
      + (CASE WHEN t.pickup_zip = ANY(p.zips) THEN 1
              WHEN t.estimated_miles IS NOT NULL AND t.estimated_miles < 50 THEN 0.4
              WHEN p.long_ok THEN 0.7 ELSE 0.2 END) * 20     -- area 20
      + (CASE
           WHEN coalesce(t.needs_wheelchair,false) AND coalesce(f.has_wc,false) THEN 1
           WHEN coalesce(t.needs_wheelchair,false) THEN 0
           WHEN coalesce(t.service_level::text,'')='stretcher' AND coalesce(f.has_stretcher,false) THEN 1
           WHEN coalesce(t.service_level::text,'')='stretcher' THEN 0
           ELSE 0.8 END) * 20                                 -- vehicle 20
      + (1 - least(1, coalesce(re.n_recent,0)/nullif((SELECT m FROM max_recent),0))) * 15  -- fairness 15
      + (least(1, ln(1 + coalesce(f.n_vehicles,0)) / ln(6)) * 5)  -- fleet 5 (diminishing)
      + (CASE WHEN last_prov IS NOT NULL AND p.user_id = last_prov THEN 1 ELSE 0 END) * 10 -- affinity 10
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
END $$;

-- 5. Priority offer: create
CREATE OR REPLACE FUNCTION public.offer_trip_priority(_trip_id uuid, _provider_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
BEGIN
  IF NOT public.is_ops_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT id, display_id, pickup_date, pickup_time INTO t FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;

  UPDATE public.trips
     SET priority_offer_provider_id = _provider_user_id,
         priority_offer_expires_at  = now() + interval '2 hours',
         priority_offer_created_at  = now(),
         priority_offer_refused_at  = NULL
   WHERE id = _trip_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_provider_user_id, 'priority_trip_offer',
          'Priority trip offer (2-hour window)',
          'You previously transported this patient. You have 2 hours to accept or refuse trip '
          || coalesce(t.display_id, t.id::text) || ' before it goes to the open pool.',
          '/provider/dashboard?tab=requests');

  PERFORM public.log_staff_action('priority_offer_created', 'trip', _trip_id::text,
    jsonb_build_object('provider_user_id', _provider_user_id));
END $$;

-- 6. Priority offer: provider response
CREATE OR REPLACE FUNCTION public.respond_priority_offer(_trip_id uuid, _accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
BEGIN
  SELECT * INTO t FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.priority_offer_provider_id IS NULL OR t.priority_offer_provider_id <> auth.uid() THEN
    RAISE EXCEPTION 'This offer is not addressed to you';
  END IF;
  IF t.priority_offer_expires_at IS NULL OR t.priority_offer_expires_at < now() THEN
    RAISE EXCEPTION 'This priority offer has expired';
  END IF;

  IF _accept THEN
    UPDATE public.trips
       SET assigned_to = auth.uid(),
           status = 'assigned',
           priority_offer_provider_id = NULL,
           priority_offer_expires_at = NULL
     WHERE id = _trip_id;
  ELSE
    UPDATE public.trips
       SET priority_offer_refused_at = now(),
           priority_offer_provider_id = NULL,
           priority_offer_expires_at = NULL
     WHERE id = _trip_id;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.suggest_providers_for_trip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_providers_for_trip(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.offer_trip_priority(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offer_trip_priority(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_priority_offer(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_priority_offer(uuid, boolean) TO authenticated;
