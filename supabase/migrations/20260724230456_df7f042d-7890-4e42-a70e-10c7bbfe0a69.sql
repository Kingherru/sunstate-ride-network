
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS zip_fallback_mode text NOT NULL DEFAULT 'manual_review'
    CHECK (zip_fallback_mode IN ('manual_review','default_zone')),
  ADD COLUMN IF NOT EXISTS zip_fallback_zone_id uuid REFERENCES public.dispatch_zones(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.zone_id_for_zip(_zip text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm text := substring(regexp_replace(coalesce(_zip,''), '\D', '', 'g') FROM 1 FOR 5);
  _zone uuid;
  _mode text;
  _fallback uuid;
BEGIN
  IF _norm IS NULL OR length(_norm) <> 5 THEN
    RETURN NULL;
  END IF;
  SELECT zone_id INTO _zone FROM public.dispatch_zone_zips WHERE zip = _norm LIMIT 1;
  IF _zone IS NOT NULL THEN
    RETURN _zone;
  END IF;
  SELECT zip_fallback_mode, zip_fallback_zone_id
    INTO _mode, _fallback
  FROM public.platform_settings WHERE id = true;
  IF _mode = 'default_zone' AND _fallback IS NOT NULL THEN
    RETURN _fallback;
  END IF;
  RETURN NULL;
END;
$$;

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
  WITH mapped AS (SELECT zip FROM public.dispatch_zone_zips),
  tzips AS (
    SELECT substring(regexp_replace(coalesce(t.pickup_zip,''),'\D','','g') FROM 1 FOR 5) AS z
    FROM public.trips t
    WHERE t.dispatch_zone_id IS NULL
      AND coalesce(t.pickup_zip,'') <> ''
  ),
  mzips AS (
    SELECT substring(regexp_replace(coalesce(m.postal_code,''),'\D','','g') FROM 1 FOR 5) AS z,
           m.role
    FROM public.member_profiles m
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
    SELECT DISTINCT z::text AS zip FROM (
      SELECT z FROM tzips WHERE z ~ '^\d{5}$'
      UNION ALL SELECT z FROM mzips WHERE z ~ '^\d{5}$'
    ) u
    WHERE z NOT IN (SELECT zip FROM mapped)
  ) z
  LEFT JOIN (SELECT z AS zip, count(*)::int AS c FROM tzips GROUP BY z) tc ON tc.zip = z.zip
  LEFT JOIN (SELECT z AS zip, count(*)::int AS c FROM mzips WHERE role='provider' GROUP BY z) pc ON pc.zip = z.zip
  LEFT JOIN (SELECT z AS zip, count(*)::int AS c FROM mzips WHERE role='facility' GROUP BY z) fc ON fc.zip = z.zip
  LEFT JOIN (SELECT z AS zip, count(*)::int AS c FROM mzips WHERE role='patient'  GROUP BY z) patc ON patc.zip = z.zip
  ORDER BY (COALESCE(tc.c,0) + COALESCE(pc.c,0) + COALESCE(fc.c,0) + COALESCE(patc.c,0)) DESC, z.zip;
END;
$$;

REVOKE ALL ON FUNCTION public.list_unmapped_zips() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_unmapped_zips() TO authenticated;
