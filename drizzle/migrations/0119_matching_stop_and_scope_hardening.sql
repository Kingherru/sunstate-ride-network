DO $$ DECLARE f text;BEGIN
SELECT pg_get_functiondef(oid) INTO f FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='provider_fleet_opportunity_guard';f:=replace(f,'''declined'',''expired'',''withdrawn'',''canceled'',''cancelled''','''declined'',''expired'',''withdrawn'',''closed'',''canceled'',''cancelled''');EXECUTE f;
SELECT pg_get_functiondef(oid) INTO f FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='contractor_offer_guard';f:=replace(f,'BEGIN IF EXISTS','BEGIN IF TG_OP=''UPDATE'' AND NEW.status IN (''closed'',''declined'',''expired'',''withdrawn'',''canceled'',''cancelled'') THEN RETURN NEW;END IF;IF EXISTS');EXECUTE f;
SELECT pg_get_functiondef(oid) INTO f FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='network_matching_candidates';
f:=replace(f,'IF NOT p.nearby_opt_in THEN','IF p.matching_settings->>''state'' IS DISTINCT FROM ''FL'' OR p.matching_settings->>''timezone'' NOT IN (''America/New_York'',''America/Chicago'') THEN reasons:=array_append(reasons,''Configured Florida geography and timezone required'');END IF; IF NOT p.nearby_opt_in THEN');
f:=replace(f,'OR p.eligibility_expires_at IS NULL','OR p.eligibility_expires_at IS NULL');EXECUTE f;
END $$;
CREATE FUNCTION public.nearby_acceptance_evidence_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c record;BEGIN
IF TG_OP='UPDATE' AND NEW.status='accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
IF NOT public.provider_network_entitled(NEW.provider_workspace_id) OR NOT EXISTS(SELECT 1 FROM public.provider_network_profiles WHERE workspace_id=NEW.provider_workspace_id AND nearby_opt_in AND matching_settings->>'availability'='available' AND matching_settings->>'acceptingTrips'='true') THEN RAISE EXCEPTION 'Current recipient eligibility required';END IF;
END IF;RETURN NEW;END $$;
CREATE TRIGGER nearby_acceptance_evidence_guard BEFORE UPDATE OF status ON public.provider_trip_offers FOR EACH ROW EXECUTE FUNCTION public.nearby_acceptance_evidence_guard();