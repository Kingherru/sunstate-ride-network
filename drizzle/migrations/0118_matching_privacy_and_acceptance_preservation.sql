DO $$ DECLARE f text;BEGIN
SELECT pg_get_functiondef(oid) INTO f FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='network_accept_offer';
IF position('AND np.visible AND np.accepting_connections' IN f)=0 THEN RAISE EXCEPTION 'Acceptance privacy guard not found';END IF;
f:=replace(f,'AND np.visible AND np.accepting_connections','AND np.nearby_opt_in');EXECUTE f;
SELECT pg_get_functiondef(oid) INTO f FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='network_matching_candidates';
f:=replace(f,'distance float8;area boolean;', 'distance float8;area boolean;pickup_zip text;passengers integer;wheelchairs integer;');
IF position('pickup_zip text' IN f)=0 THEN f:=replace(f,'distance double precision;area boolean;', 'distance double precision;area boolean;pickup_zip text;passengers integer;wheelchairs integer;');END IF;
f:=replace(f,'FOR p IN SELECT', 'SELECT r.pickup_zip,coalesce(r.passenger_count,1),coalesce(r.wheelchair_positions,0) INTO pickup_zip,passengers,wheelchairs FROM public.ride_requests r WHERE r.id=d.request_id; IF d.request_id IS NULL THEN SELECT t.pickup_zip,coalesce(t.passenger_count,1),coalesce(t.wheelchair_positions,0) INTO pickup_zip,passengers,wheelchairs FROM public.trips t WHERE t.id=d.trip_id;END IF; FOR p IN SELECT');
f:=replace(f,'area:=lower(d.pickup_area)=ANY(SELECT lower(x) FROM unnest(p.cities) x);','area:=coalesce(pickup_zip=ANY(p.zips),false) OR lower(d.pickup_area)=ANY(SELECT lower(x) FROM unnest(p.cities) x);');
f:=replace(f,'v.capacity>0','v.capacity>=coalesce(passengers,1)');f:=replace(f,'v.wheelchair_capacity>0','v.wheelchair_capacity>=greatest(1,coalesce(wheelchairs,1))');
f:=replace(f,'CASE WHEN lower(d.pickup_area)=ANY(SELECT lower(x) FROM unnest(p.cities) x) THEN 70 ELSE 20 END','CASE WHEN pickup_zip=ANY(p.zips) THEN 100 WHEN lower(d.pickup_area)=ANY(SELECT lower(x) FROM unnest(p.cities) x) THEN 70 ELSE 20 END');EXECUTE f;
SELECT pg_get_functiondef(oid) INTO f FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='contractor_network_directory';
f:=replace(f,'''business_name'',w.display_name','''business_name'',CASE WHEN w.provider_subtype=''independent_contractor'' THEN p.matching_settings->>''displayName'' ELSE w.display_name END');
f:=replace(f,'AND p.visible AND EXISTS','AND p.visible AND (w.provider_subtype<>''independent_contractor'' OR (nullif(trim(p.matching_settings->>''displayName''),'''') IS NOT NULL AND (p.contact_email_public OR p.contact_phone_public OR p.accepting_connections))) AND EXISTS');EXECUTE f;
END $$;
CREATE FUNCTION public.matching_consent_insert_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.nearby_opt_in OR NEW.matching_settings<>'{}'::jsonb OR NEW.matching_consent<>'{}'::jsonb THEN RAISE EXCEPTION 'Create profile with nearby off then use audited settings';END IF;RETURN NEW;END $$;
CREATE TRIGGER matching_profile_insert_guard BEFORE INSERT ON public.provider_network_profiles FOR EACH ROW EXECUTE FUNCTION public.matching_consent_insert_guard();