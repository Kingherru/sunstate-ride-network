
UPDATE public.dispatch_zones SET name='Panhandle',                         is_preset=true, sort_order=1 WHERE code='PANHANDLE';
UPDATE public.dispatch_zones SET name='North Florida',                     is_preset=true, sort_order=2 WHERE code='NORTH';
UPDATE public.dispatch_zones SET name='Central Florida',                   is_preset=true, sort_order=3 WHERE code='CENTRAL';
UPDATE public.dispatch_zones SET name='Tampa Bay / Southwest Florida',     is_preset=true, sort_order=4 WHERE code='SOUTHWEST';
UPDATE public.dispatch_zones SET name='South Florida',                     is_preset=true, sort_order=5 WHERE code='SOUTHEAST';

INSERT INTO public.dispatch_zones (code, name, sort_order, is_preset) VALUES
  ('PANHANDLE','Panhandle',1,true),
  ('NORTH','North Florida',2,true),
  ('CENTRAL','Central Florida',3,true),
  ('SOUTHWEST','Tampa Bay / Southwest Florida',4,true),
  ('SOUTHEAST','South Florida',5,true)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fl_zip_zone_code(_zip text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE substring(regexp_replace(coalesce(_zip,''),'\D','','g') FROM 1 FOR 3)
    WHEN '320' THEN 'NORTH'      WHEN '321' THEN 'CENTRAL'
    WHEN '322' THEN 'NORTH'      WHEN '323' THEN 'PANHANDLE'
    WHEN '324' THEN 'PANHANDLE'  WHEN '325' THEN 'PANHANDLE'
    WHEN '326' THEN 'NORTH'      WHEN '327' THEN 'CENTRAL'
    WHEN '328' THEN 'CENTRAL'    WHEN '329' THEN 'CENTRAL'
    WHEN '330' THEN 'SOUTHEAST'  WHEN '331' THEN 'SOUTHEAST'
    WHEN '332' THEN 'SOUTHEAST'  WHEN '333' THEN 'SOUTHEAST'
    WHEN '334' THEN 'SOUTHEAST'  WHEN '335' THEN 'SOUTHWEST'
    WHEN '336' THEN 'SOUTHWEST'  WHEN '337' THEN 'SOUTHWEST'
    WHEN '338' THEN 'CENTRAL'    WHEN '339' THEN 'SOUTHWEST'
    WHEN '341' THEN 'SOUTHWEST'  WHEN '342' THEN 'SOUTHWEST'
    WHEN '344' THEN 'NORTH'      WHEN '346' THEN 'SOUTHWEST'
    WHEN '347' THEN 'CENTRAL'
    ELSE NULL END
$$;

UPDATE public.trips t
   SET dispatch_zone_id = rz.id
  FROM public.dispatch_zones rz
 WHERE t.dispatch_zone_id IN (SELECT id FROM public.dispatch_zones WHERE is_preset = false)
   AND rz.is_preset = true
   AND rz.code = public.fl_zip_zone_code(t.pickup_zip);

UPDATE public.trips SET dispatch_zone_id = NULL
 WHERE dispatch_zone_id IN (SELECT id FROM public.dispatch_zones WHERE is_preset = false);

UPDATE public.member_profiles mp
   SET dispatch_zone_id = rz.id
  FROM public.dispatch_zones rz
 WHERE mp.dispatch_zone_id IN (SELECT id FROM public.dispatch_zones WHERE is_preset = false)
   AND rz.is_preset = true
   AND rz.code = public.fl_zip_zone_code(mp.postal_code);

UPDATE public.member_profiles SET dispatch_zone_id = NULL
 WHERE dispatch_zone_id IN (SELECT id FROM public.dispatch_zones WHERE is_preset = false);

DELETE FROM public.dispatch_zones WHERE is_preset = false;

INSERT INTO public.dispatch_zone_zips (zip, zone_id)
SELECT lpad(z::text,5,'0'), rz.id
  FROM generate_series(32000, 34999) AS z
  JOIN public.dispatch_zones rz
    ON rz.is_preset = true
   AND rz.code = public.fl_zip_zone_code(lpad(z::text,5,'0'))
ON CONFLICT (zip) DO UPDATE SET zone_id = EXCLUDED.zone_id;

CREATE OR REPLACE FUNCTION public.assign_member_dispatch_zone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _zip text; _zone uuid;
BEGIN
  _zip := coalesce(NEW.postal_code, (NEW.preferred_zip_codes)[1]);
  IF _zip IS NOT NULL THEN
    _zip := substring(regexp_replace(_zip,'\D','','g') FROM 1 FOR 5);
    SELECT zone_id INTO _zone FROM public.dispatch_zone_zips WHERE zip = _zip;
    IF _zone IS NOT NULL THEN NEW.dispatch_zone_id := _zone; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_member_dispatch_zone ON public.member_profiles;
CREATE TRIGGER trg_member_dispatch_zone
BEFORE INSERT OR UPDATE OF postal_code, preferred_zip_codes ON public.member_profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_member_dispatch_zone();

UPDATE public.member_profiles mp
   SET dispatch_zone_id = dzz.zone_id
  FROM public.dispatch_zone_zips dzz
 WHERE mp.dispatch_zone_id IS NULL
   AND dzz.zip = substring(regexp_replace(coalesce(mp.postal_code, (mp.preferred_zip_codes)[1], ''),'\D','','g') FROM 1 FOR 5);

CREATE OR REPLACE FUNCTION public.dispatch_zone_stats()
RETURNS TABLE(
  zone_id uuid, code text, name text, sort_order int,
  zip_count int, providers int, facilities int, patients int, active_trips int,
  managers jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH z AS (SELECT id, code, name, sort_order FROM public.dispatch_zones WHERE is_preset = true)
  SELECT
    z.id, z.code, z.name, z.sort_order,
    (SELECT count(*)::int FROM public.dispatch_zone_zips WHERE zone_id = z.id),
    (SELECT count(*)::int FROM public.member_profiles mp
       WHERE mp.dispatch_zone_id = z.id AND mp.provider_application_id IS NOT NULL),
    (SELECT count(*)::int FROM public.member_profiles mp
       WHERE mp.dispatch_zone_id = z.id AND mp.provider_application_id IS NULL
         AND (mp.auto_upgraded_to_facility_at IS NOT NULL OR coalesce(mp.patient_type,'') ILIKE '%facility%')),
    (SELECT count(*)::int FROM public.member_profiles mp
       WHERE mp.dispatch_zone_id = z.id AND mp.provider_application_id IS NULL
         AND mp.auto_upgraded_to_facility_at IS NULL
         AND coalesce(mp.patient_type,'') NOT ILIKE '%facility%'),
    (SELECT count(*)::int FROM public.trips t
       WHERE t.dispatch_zone_id = z.id
         AND coalesce(t.status,'') NOT IN ('completed','canceled')),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'user_id', zma.user_id,
               'name', COALESCE(NULLIF(TRIM(concat_ws(' ', mp.first_name, mp.last_name)), ''), mp.company_name, ''),
               'email', mp.dispatch_email))
        FROM public.zone_manager_assignments zma
        LEFT JOIN public.member_profiles mp ON mp.user_id = zma.user_id
       WHERE zma.zone_id = z.id
    ), '[]'::jsonb)
  FROM z
  ORDER BY z.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_zone_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fl_zip_zone_code(text) TO authenticated;
