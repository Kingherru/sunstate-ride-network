CREATE FUNCTION public.admin_request_action(_request uuid, _action text, _reason text DEFAULT NULL, _patch jsonb DEFAULT '{}'::jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec public.ride_requests; mfn text; clean jsonb; allowed text[] := ARRAY['pickup_address','pickup_address_details','pickup_city','pickup_zip','dropoff_address','dropoff_city','dropoff_zip','pickup_date','pickup_time','appointment_time','patient_phone','patient_email','special_instructions','delivery_instructions','mobility_notes'];
  r text := nullif(left(trim(coalesce(_reason,'')),500),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO rec FROM public.ride_requests WHERE id = _request FOR UPDATE;
  IF rec.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT (public.admin_can('requests','manage') AND public.admin_can_account(rec.workspace_id)) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF rec.deactivated_at IS NOT NULL THEN RAISE EXCEPTION 'Request is deactivated'; END IF;
  SELECT mfn_id INTO mfn FROM public.user_profiles WHERE user_id = auth.uid();
  IF _action = 'edit' THEN
    SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) INTO clean FROM jsonb_each(coalesce(_patch,'{}'::jsonb)) AS e(k, v) WHERE k = ANY(allowed);
    IF clean = '{}'::jsonb THEN RAISE EXCEPTION 'No permitted changes'; END IF;
    rec := jsonb_populate_record(rec, clean);
    UPDATE public.ride_requests SET pickup_address=rec.pickup_address, pickup_address_details=rec.pickup_address_details, pickup_city=rec.pickup_city, pickup_zip=rec.pickup_zip,
      dropoff_address=rec.dropoff_address, dropoff_city=rec.dropoff_city, dropoff_zip=rec.dropoff_zip, pickup_date=rec.pickup_date, pickup_time=rec.pickup_time,
      appointment_time=rec.appointment_time, patient_phone=rec.patient_phone, patient_email=rec.patient_email, special_instructions=rec.special_instructions,
      delivery_instructions=rec.delivery_instructions, mobility_notes=rec.mobility_notes WHERE id = _request;
    INSERT INTO public.request_status_events(ride_request_id, actor_user_id, actor_mfn_id, action, from_state, to_state, note)
    VALUES (_request, auth.uid(), mfn, 'edited', rec.lifecycle_state, rec.lifecycle_state, left('Updated: ' || (SELECT string_agg(k, ', ') FROM jsonb_object_keys(clean) k) || coalesce(' — ' || r, ''), 500));
    RETURN rec.lifecycle_state;
  ELSIF _action = 'deny' THEN
    IF r IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
    IF NOT public.request_lifecycle_allowed(rec.lifecycle_state, 'declined') THEN RAISE EXCEPTION 'That status change is not allowed'; END IF;
    UPDATE public.ride_requests SET lifecycle_state = 'declined' WHERE id = _request;
    INSERT INTO public.request_status_events(ride_request_id, actor_user_id, actor_mfn_id, action, from_state, to_state, note)
    VALUES (_request, auth.uid(), mfn, 'denied', rec.lifecycle_state, 'declined', r);
    RETURN 'declined';
  ELSIF _action = 'deactivate' THEN
    IF r IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
    UPDATE public.ride_requests SET deactivated_at = now() WHERE id = _request;
    INSERT INTO public.request_status_events(ride_request_id, actor_user_id, actor_mfn_id, action, from_state, to_state, note)
    VALUES (_request, auth.uid(), mfn, 'deactivated', rec.lifecycle_state, rec.lifecycle_state, r);
    RETURN rec.lifecycle_state;
  END IF;
  RAISE EXCEPTION 'Unknown action';
END $$;
REVOKE ALL ON FUNCTION public.admin_request_action(uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_request_action(uuid,text,text,jsonb) TO authenticated;

CREATE FUNCTION public.admin_person_scope_ok(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.admin_can('people','manage') AND _user <> auth.uid()
    AND NOT public.is_master_admin(_user)
    AND (public.is_master_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.user_id = _user AND m.removed_at IS NULL AND public.admin_can_account(m.workspace_id)))
$$;
REVOKE ALL ON FUNCTION public.admin_person_scope_ok(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_person_scope_ok(uuid) TO authenticated;

CREATE FUNCTION public.admin_update_person(_user uuid, _first text, _last text, _phone text, _postal text, _city text, _reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tgt text;
BEGIN
  IF NOT public.admin_person_scope_ok(_user) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _postal IS NOT NULL AND _postal <> '' AND _postal !~ '^\d{5}(-\d{4})?$' THEN RAISE EXCEPTION 'ZIP code must be 5 digits'; END IF;
  UPDATE public.user_profiles SET first_name = nullif(trim(_first),''), last_name = nullif(trim(_last),''), phone = nullif(trim(_phone),''),
    display_name = coalesce(nullif(trim(concat_ws(' ', nullif(trim(_first),''), nullif(trim(_last),''))),''), display_name)
    WHERE user_id = _user AND deleted_at IS NULL RETURNING mfn_id INTO tgt;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  UPDATE public.member_profiles SET postal_code = nullif(trim(_postal),''), city = nullif(trim(_city),'') WHERE user_id = _user;
  PERFORM public.log_staff_action('account_profile_corrected','person',tgt,jsonb_build_object('reason', left(coalesce(_reason,''),500)));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_update_person(uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_person(uuid,text,text,text,text,text,text) TO authenticated;

CREATE FUNCTION public.admin_set_person_active(_user uuid, _active boolean, _reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tgt text; test boolean;
BEGIN
  IF NOT public.admin_person_scope_ok(_user) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF length(trim(coalesce(_reason,''))) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT mfn_id, is_test_account INTO tgt, test FROM public.user_profiles WHERE user_id = _user AND deleted_at IS NULL;
  IF tgt IS NULL THEN RAISE EXCEPTION 'Account not found'; END IF;
  IF _active AND test THEN RAISE EXCEPTION 'Disabled test accounts stay disabled'; END IF;
  UPDATE public.user_profiles SET status = CASE WHEN _active THEN 'active'::profile_status ELSE 'suspended'::profile_status END WHERE user_id = _user;
  PERFORM public.log_staff_action(CASE WHEN _active THEN 'account_restored' ELSE 'account_deactivated' END,'person',tgt,jsonb_build_object('reason', left(trim(_reason),500)));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_person_active(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_person_active(uuid,boolean,text) TO authenticated;