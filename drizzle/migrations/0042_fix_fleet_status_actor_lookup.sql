CREATE OR REPLACE FUNCTION public.set_fleet_resource_status(_kind text, _id uuid, _status text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid; prev text; ref text; actor_mfn text;
BEGIN
  IF auth.uid() IS NULL OR _status NOT IN ('active','inactive') OR length(btrim(coalesce(_reason,''))) < 3 THEN
    RAISE EXCEPTION 'unavailable';
  END IF;
  IF _kind = 'driver' THEN
    SELECT workspace_id, status, btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) || ' · ' || left(id::text, 8) INTO ws, prev, ref FROM drivers WHERE id = _id FOR UPDATE;
  ELSIF _kind = 'vehicle' THEN
    SELECT workspace_id, status, coalesce(name,'') || ' · ' || left(id::text, 8) INTO ws, prev, ref FROM vehicles WHERE id = _id FOR UPDATE;
  ELSE RAISE EXCEPTION 'unavailable'; END IF;
  IF ws IS NULL OR NOT public.is_provider_workspace_manager(ws, auth.uid()) THEN RAISE EXCEPTION 'unavailable'; END IF;
  IF prev = _status THEN RETURN jsonb_build_object('ok', true, 'unchanged', true); END IF;
  IF _kind = 'driver' THEN UPDATE drivers SET status = _status, updated_at = now() WHERE id = _id;
  ELSE UPDATE vehicles SET status = _status, updated_at = now() WHERE id = _id; END IF;
  SELECT mfn_id INTO actor_mfn FROM user_profiles WHERE user_id = auth.uid();
  INSERT INTO fleet_resource_status_events(workspace_id, resource_kind, resource_id, resource_reference, previous_status, new_status, reason, actor_user_id, actor_mfn_id)
  VALUES (ws, _kind, _id, ref, prev, _status, btrim(_reason), auth.uid(), actor_mfn);
  RETURN jsonb_build_object('ok', true);
END $$;