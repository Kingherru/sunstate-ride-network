CREATE OR REPLACE FUNCTION public.list_unmapped_zips()
RETURNS TABLE (
  zip text,
  trip_count integer,
  provider_count integer,
  facility_count integer,
  patient_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'app_manager')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  WITH mapped AS (SELECT dz.zip FROM public.dispatch_zone_zips dz),
  tzips AS (
    SELECT substring(regexp_replace(coalesce(t.pickup_zip,''),'\D','','g') FROM 1 FOR 5) AS z
    FROM public.trips t
    WHERE t.dispatch_zone_id IS NULL
      AND coalesce(t.pickup_zip,'') <> ''
  ),
  mzips AS (
    SELECT substring(regexp_replace(coalesce(m.postal_code,''),'\D','','g') FROM 1 FOR 5) AS z,
           ur.role::text AS role
    FROM public.member_profiles m
    LEFT JOIN public.user_roles ur ON ur.user_id = m.user_id
    WHERE m.dispatch_zone_id IS NULL
      AND coalesce(m.postal_code,'') <> ''
  )
  SELECT
    z.zip,
    COALESCE(tc.c,0)::int AS trip_count,
    COALESCE(pc.c,0)::int AS provider_count,
    COALESCE(fc.c,0)::int AS facility_count,
    COALESCE(patc.c,0)::int AS patient_count
  FROM (
    SELECT DISTINCT u.z::text AS zip FROM (
      SELECT z FROM tzips WHERE z ~ '^\d{5}$'
      UNION ALL SELECT z FROM mzips WHERE z ~ '^\d{5}$'
    ) u
    WHERE u.z NOT IN (SELECT mapped.zip FROM mapped)
  ) z
  LEFT JOIN (SELECT tzips.z AS zip, count(*)::int AS c FROM tzips GROUP BY tzips.z) tc ON tc.zip = z.zip
  LEFT JOIN (SELECT mzips.z AS zip, count(*)::int AS c FROM mzips WHERE mzips.role='provider' GROUP BY mzips.z) pc ON pc.zip = z.zip
  LEFT JOIN (SELECT mzips.z AS zip, count(*)::int AS c FROM mzips WHERE mzips.role='facility' GROUP BY mzips.z) fc ON fc.zip = z.zip
  LEFT JOIN (SELECT mzips.z AS zip, count(*)::int AS c FROM mzips WHERE mzips.role='patient'  GROUP BY mzips.z) patc ON patc.zip = z.zip
  ORDER BY (COALESCE(tc.c,0) + COALESCE(pc.c,0) + COALESCE(fc.c,0) + COALESCE(patc.c,0)) DESC, z.zip;
END;
$$;

REVOKE ALL ON FUNCTION public.list_unmapped_zips() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unmapped_zips() TO authenticated;