CREATE OR REPLACE VIEW public.zone_pricing_averages AS
SELECT
  dz.id                                       AS zone_id,
  dz.code                                     AS zone_code,
  dz.name                                     AS zone_name,
  COUNT(DISTINCT pp.owner_id)::int            AS provider_count,
  ROUND(AVG(pp.base_pickup)::numeric, 2)      AS avg_base_pickup,
  ROUND(AVG(pp.per_mile)::numeric, 2)         AS avg_per_mile,
  ROUND(AVG(NULLIF(pp.wait_per_min, 0))::numeric, 2)     AS avg_wait_per_min,
  ROUND(AVG(NULLIF(pp.minimum_fare, 0))::numeric, 2)     AS avg_minimum_fare,
  ROUND(AVG(NULLIF(pp.wheelchair_addon, 0))::numeric, 2) AS avg_wheelchair_addon,
  ROUND(AVG(NULLIF(pp.stretcher_addon, 0))::numeric, 2)  AS avg_stretcher_addon,
  MAX(pp.updated_at)                          AS last_updated_at
FROM public.dispatch_zones dz
LEFT JOIN public.dispatch_zone_zips dzz ON dzz.zone_id = dz.id
LEFT JOIN public.member_profiles mp
  ON mp.membership_status = 'active'
 AND mp.preferred_zip_codes IS NOT NULL
 AND dzz.zip = ANY(mp.preferred_zip_codes)
LEFT JOIN public.provider_pricing pp ON pp.owner_id = mp.user_id
GROUP BY dz.id, dz.code, dz.name;

GRANT SELECT ON public.zone_pricing_averages TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.zone_id_for_zip(_zip text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT zone_id FROM public.dispatch_zone_zips
   WHERE zip = substring(regexp_replace(coalesce(_zip,''), '\D', '', 'g') FROM 1 FOR 5)
   LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.zone_id_for_zip(text) TO anon, authenticated, service_role;