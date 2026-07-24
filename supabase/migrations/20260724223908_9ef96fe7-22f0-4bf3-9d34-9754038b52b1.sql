
ALTER TABLE public.dispatch_zones
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'region' CHECK (kind IN ('region','county')),
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES public.dispatch_zones(id) ON DELETE SET NULL;

UPDATE public.dispatch_zones SET kind='region', region_id=NULL
 WHERE code IN ('PANHANDLE','NORTH','CENTRAL','SOUTHWEST','SOUTHEAST');
UPDATE public.dispatch_zones SET kind='county' WHERE code LIKE 'fl-%';

CREATE INDEX IF NOT EXISTS idx_dispatch_zones_kind ON public.dispatch_zones(kind);
CREATE INDEX IF NOT EXISTS idx_dispatch_zones_region ON public.dispatch_zones(region_id);

DO $$
DECLARE
  r_panhandle uuid; r_north uuid; r_central uuid; r_southwest uuid; r_southeast uuid;
  counties text[][] := ARRAY[
    ['PANHANDLE','Escambia'],['PANHANDLE','Santa Rosa'],['PANHANDLE','Okaloosa'],
    ['PANHANDLE','Walton'],['PANHANDLE','Holmes'],['PANHANDLE','Washington'],
    ['PANHANDLE','Bay'],['PANHANDLE','Jackson'],['PANHANDLE','Calhoun'],
    ['PANHANDLE','Gulf'],['PANHANDLE','Liberty'],['PANHANDLE','Franklin'],
    ['PANHANDLE','Gadsden'],['PANHANDLE','Leon'],['PANHANDLE','Wakulla'],
    ['PANHANDLE','Jefferson'],
    ['NORTH','Madison'],['NORTH','Taylor'],['NORTH','Hamilton'],['NORTH','Suwannee'],
    ['NORTH','Lafayette'],['NORTH','Dixie'],['NORTH','Columbia'],['NORTH','Baker'],
    ['NORTH','Nassau'],['NORTH','Duval'],['NORTH','Clay'],['NORTH','Bradford'],
    ['NORTH','Union'],['NORTH','Gilchrist'],['NORTH','Levy'],['NORTH','Alachua'],
    ['NORTH','Putnam'],['NORTH','St. Johns'],['NORTH','Flagler'],['NORTH','Marion'],
    ['CENTRAL','Citrus'],['CENTRAL','Sumter'],['CENTRAL','Lake'],['CENTRAL','Volusia'],
    ['CENTRAL','Seminole'],['CENTRAL','Orange'],['CENTRAL','Osceola'],['CENTRAL','Brevard'],
    ['CENTRAL','Indian River'],['CENTRAL','Polk'],['CENTRAL','Hardee'],['CENTRAL','Highlands'],
    ['CENTRAL','Okeechobee'],['CENTRAL','St. Lucie'],['CENTRAL','Martin'],
    ['SOUTHWEST','Hernando'],['SOUTHWEST','Pasco'],['SOUTHWEST','Pinellas'],
    ['SOUTHWEST','Hillsborough'],['SOUTHWEST','Manatee'],['SOUTHWEST','Sarasota'],
    ['SOUTHWEST','DeSoto'],['SOUTHWEST','Charlotte'],['SOUTHWEST','Lee'],
    ['SOUTHWEST','Glades'],['SOUTHWEST','Hendry'],['SOUTHWEST','Collier'],
    ['SOUTHEAST','Palm Beach'],['SOUTHEAST','Broward'],['SOUTHEAST','Miami-Dade'],
    ['SOUTHEAST','Monroe']
  ];
  i int; rid uuid; county_code text; county_name text; region_code text;
BEGIN
  SELECT id INTO r_panhandle FROM public.dispatch_zones WHERE code='PANHANDLE';
  SELECT id INTO r_north     FROM public.dispatch_zones WHERE code='NORTH';
  SELECT id INTO r_central   FROM public.dispatch_zones WHERE code='CENTRAL';
  SELECT id INTO r_southwest FROM public.dispatch_zones WHERE code='SOUTHWEST';
  SELECT id INTO r_southeast FROM public.dispatch_zones WHERE code='SOUTHEAST';

  FOR i IN 1..array_length(counties,1) LOOP
    region_code := counties[i][1];
    county_name := counties[i][2];
    county_code := 'fl-' || lower(regexp_replace(county_name, '[^a-zA-Z0-9]+', '-', 'g'));
    rid := CASE region_code
      WHEN 'PANHANDLE' THEN r_panhandle
      WHEN 'NORTH'     THEN r_north
      WHEN 'CENTRAL'   THEN r_central
      WHEN 'SOUTHWEST' THEN r_southwest
      WHEN 'SOUTHEAST' THEN r_southeast
    END;
    INSERT INTO public.dispatch_zones (code, name, kind, region_id, sort_order)
    VALUES (county_code, county_name || ' County, FL', 'county', rid, 10)
    ON CONFLICT (code) DO UPDATE
      SET kind='county', region_id=EXCLUDED.region_id, name=EXCLUDED.name;
  END LOOP;
END $$;

ALTER TABLE public.dispatch_zone_zips
  ADD COLUMN IF NOT EXISTS county_id uuid REFERENCES public.dispatch_zones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_zone_zips_county ON public.dispatch_zone_zips(county_id);

DROP FUNCTION IF EXISTS public.dispatch_zone_stats();
CREATE OR REPLACE FUNCTION public.dispatch_zone_stats()
RETURNS TABLE (
  zone_id uuid, code text, name text, sort_order int,
  zip_count bigint, providers bigint, facilities bigint,
  patients bigint, active_trips bigint,
  managers jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    z.id, z.code, z.name, z.sort_order,
    (SELECT count(*) FROM public.dispatch_zone_zips zz WHERE zz.zone_id=z.id),
    (SELECT count(DISTINCT mp.user_id) FROM public.member_profiles mp
       JOIN public.user_roles ur ON ur.user_id=mp.user_id
      WHERE mp.dispatch_zone_id=z.id AND ur.role::text='provider'),
    (SELECT count(DISTINCT mp.user_id) FROM public.member_profiles mp
       JOIN public.user_roles ur ON ur.user_id=mp.user_id
      WHERE mp.dispatch_zone_id=z.id AND ur.role::text='facility'),
    (SELECT count(DISTINCT mp.user_id) FROM public.member_profiles mp
       JOIN public.user_roles ur ON ur.user_id=mp.user_id
      WHERE mp.dispatch_zone_id=z.id AND ur.role::text='patient'),
    (SELECT count(*) FROM public.trips t
      WHERE t.dispatch_zone_id=z.id
        AND coalesce(t.status,'') NOT IN ('completed','canceled','cancelled')),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', zm.user_id,
        'name', COALESCE(mp2.company_name, NULLIF(trim(concat_ws(' ', mp2.first_name, mp2.last_name)),''), left(zm.user_id::text,8)),
        'email', NULL
      ))
      FROM public.zone_manager_assignments zm
      LEFT JOIN public.member_profiles mp2 ON mp2.user_id=zm.user_id
      WHERE zm.zone_id=z.id
    ), '[]'::jsonb)
  FROM public.dispatch_zones z
  WHERE z.kind='region'
  ORDER BY z.sort_order;
$$;
REVOKE ALL ON FUNCTION public.dispatch_zone_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_zone_stats() TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.dispatch_county_stats(uuid);
CREATE OR REPLACE FUNCTION public.dispatch_county_stats(_region_id uuid DEFAULT NULL)
RETURNS TABLE (
  county_id uuid, code text, name text, region_id uuid, region_code text,
  zip_count bigint, providers bigint, facilities bigint,
  patients bigint, active_trips bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id, c.code, c.name, c.region_id, r.code,
    (SELECT count(*) FROM public.dispatch_zone_zips zz WHERE zz.county_id=c.id),
    (SELECT count(DISTINCT mp.user_id) FROM public.member_profiles mp
       JOIN public.dispatch_zone_zips zz ON zz.zip=mp.postal_code AND zz.county_id=c.id
       JOIN public.user_roles ur ON ur.user_id=mp.user_id
      WHERE ur.role::text='provider'),
    (SELECT count(DISTINCT mp.user_id) FROM public.member_profiles mp
       JOIN public.dispatch_zone_zips zz ON zz.zip=mp.postal_code AND zz.county_id=c.id
       JOIN public.user_roles ur ON ur.user_id=mp.user_id
      WHERE ur.role::text='facility'),
    (SELECT count(DISTINCT mp.user_id) FROM public.member_profiles mp
       JOIN public.dispatch_zone_zips zz ON zz.zip=mp.postal_code AND zz.county_id=c.id
       JOIN public.user_roles ur ON ur.user_id=mp.user_id
      WHERE ur.role::text='patient'),
    (SELECT count(*) FROM public.trips t
       JOIN public.dispatch_zone_zips zz ON zz.zip=t.pickup_zip AND zz.county_id=c.id
      WHERE coalesce(t.status,'') NOT IN ('completed','canceled','cancelled'))
  FROM public.dispatch_zones c
  LEFT JOIN public.dispatch_zones r ON r.id=c.region_id
  WHERE c.kind='county'
    AND (_region_id IS NULL OR c.region_id=_region_id)
  ORDER BY c.name;
$$;
REVOKE ALL ON FUNCTION public.dispatch_county_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_county_stats(uuid) TO authenticated, service_role;
