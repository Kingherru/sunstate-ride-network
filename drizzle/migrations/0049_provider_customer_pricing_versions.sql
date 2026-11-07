CREATE TABLE public.provider_customer_pricing_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id), version integer NOT NULL CHECK(version > 0), effective_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid NOT NULL, person_mfn_id text NOT NULL, workspace_mfn_id text NOT NULL, rates jsonb NOT NULL CHECK(jsonb_typeof(rates)='object'), legacy_snapshot jsonb, UNIQUE(workspace_id,version)
);
GRANT SELECT ON public.provider_customer_pricing_versions TO authenticated;
GRANT ALL ON public.provider_customer_pricing_versions TO service_role;
ALTER TABLE public.provider_customer_pricing_versions ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.can_manage_provider_customer_pricing(_workspace uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.workspace_members m JOIN public.workspaces w ON w.id=m.workspace_id JOIN public.user_profiles p ON p.user_id=m.user_id WHERE m.workspace_id=_workspace AND m.user_id=auth.uid() AND m.role IN ('owner','admin') AND NOT m.is_contractor AND m.removed_at IS NULL AND w.account_type='provider' AND w.status='active' AND NOT w.is_test_account AND p.status='active' AND NOT p.is_test_account AND p.deleted_at IS NULL)
$$;
REVOKE ALL ON FUNCTION public.can_manage_provider_customer_pricing(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_manage_provider_customer_pricing(uuid) TO authenticated,service_role;
CREATE POLICY provider_customer_pricing_read ON public.provider_customer_pricing_versions FOR SELECT TO authenticated USING(public.can_manage_provider_customer_pricing(workspace_id));
CREATE FUNCTION public.save_provider_customer_pricing(_workspace uuid,_rates jsonb,_expected_version integer,_confirmed boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _current integer; _id uuid; _person text; _account text; _owner uuid; _legacy jsonb; _service text; _field text; _value jsonb;
BEGIN
 IF NOT public.can_manage_provider_customer_pricing(_workspace) OR _confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Customer pricing unavailable'; END IF;
 PERFORM 1 FROM public.workspaces WHERE id=_workspace FOR UPDATE;
 SELECT COALESCE(MAX(version),0) INTO _current FROM public.provider_customer_pricing_versions WHERE workspace_id=_workspace;
 IF _expected_version IS DISTINCT FROM _current THEN RAISE EXCEPTION 'Rates changed; reload before saving'; END IF;
 IF jsonb_typeof(_rates) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(_rates))<>4 THEN RAISE EXCEPTION 'Invalid service rates'; END IF;
 FOREACH _service IN ARRAY ARRAY['ambulatory','wheelchair','stretcher','medical_delivery'] LOOP
 IF jsonb_typeof(_rates->_service) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Missing service'; END IF;
 FOREACH _field IN ARRAY ARRAY['base_cents','minimum_cents','included_miles','per_mile_cents','wait_cents','wait_unit','after_hours_cents','holiday_cents','additional_stop_cents','cancellation_cents','no_show_cents','additional_passenger_cents','cold_chain_cents','signature_cents','rush_cents','round_trip','after_hours_start','after_hours_end','holidays'] LOOP
 IF NOT (_rates->_service ? _field) THEN RAISE EXCEPTION 'Missing rate component'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_object_keys(_rates->_service))<>19 THEN RAISE EXCEPTION 'Unknown rate component'; END IF;
 FOR _field,_value IN SELECT key,value FROM jsonb_each(_rates->_service) LOOP
 IF _field IN ('wait_unit','round_trip','after_hours_start','after_hours_end','holidays') THEN CONTINUE; END IF;
 IF jsonb_typeof(_value)<>'number' OR (_value::text)::numeric<0 OR (_field<>'included_miles' AND ((_value::text)::numeric<>trunc((_value::text)::numeric) OR (_value::text)::numeric>9007199254740991)) THEN RAISE EXCEPTION 'Invalid nonnegative rate'; END IF;
 END LOOP;
 IF _rates->_service->>'wait_unit' NOT IN ('minute','half_hour','hour') OR _rates->_service->>'round_trip' NOT IN ('per_leg','single_pickup') OR (_rates->_service->>'after_hours_start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR (_rates->_service->>'after_hours_end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR jsonb_typeof(_rates->_service->'holidays')<>'array' THEN RAISE EXCEPTION 'Invalid pricing behavior'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(_rates->_service->'holidays') d WHERE d !~ '^\d{4}-\d{2}-\d{2}$') THEN RAISE EXCEPTION 'Invalid holiday'; END IF;
 END LOOP;
 SELECT mfn_id INTO _person FROM public.user_profiles WHERE user_id=auth.uid(); SELECT mfn_id INTO _account FROM public.workspaces WHERE id=_workspace;
 SELECT user_id INTO _owner FROM public.workspace_members WHERE workspace_id=_workspace AND role='owner' AND NOT is_contractor AND removed_at IS NULL ORDER BY created_at LIMIT 1;
 SELECT to_jsonb(p) INTO _legacy FROM public.provider_pricing p WHERE owner_id=_owner;
 INSERT INTO public.provider_customer_pricing_versions(workspace_id,version,created_by,person_mfn_id,workspace_mfn_id,rates,legacy_snapshot) VALUES(_workspace,_current+1,auth.uid(),_person,_account,_rates,CASE WHEN _current=0 THEN _legacy ELSE NULL END) RETURNING id INTO _id;
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.save_provider_customer_pricing(uuid,jsonb,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_provider_customer_pricing(uuid,jsonb,integer,boolean) TO authenticated;
CREATE FUNCTION public.prevent_customer_pricing_history_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Customer pricing history is append-only'; END $$;
CREATE TRIGGER customer_pricing_history_immutable BEFORE UPDATE OR DELETE ON public.provider_customer_pricing_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_pricing_history_change();
ALTER TABLE public.provider_credentials ADD COLUMN insurance_carrier text, ADD COLUMN policy_reference text, ADD COLUMN coverage_cents bigint CHECK(coverage_cents>=0);
COMMENT ON TABLE public.provider_customer_pricing_versions IS 'Private effective-dated extension of legacy provider_pricing; never updates legacy rates or trip/invoice snapshots.';