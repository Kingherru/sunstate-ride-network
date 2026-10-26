ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS first_name text, ADD COLUMN IF NOT EXISTS last_name text, ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"in_app":true,"email":false}'::jsonb;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS selected_provider_workspace_id uuid REFERENCES public.workspaces(id), ADD COLUMN IF NOT EXISTS selected_provider_mfn_id text, ADD COLUMN IF NOT EXISTS requester_workspace_mfn_id text, ADD COLUMN IF NOT EXISTS provider_selection_status text;
ALTER TABLE public.provider_network_profiles ADD COLUMN IF NOT EXISTS location_city text, ADD COLUMN IF NOT EXISTS location_county text, ADD COLUMN IF NOT EXISTS location_zip text, ADD COLUMN IF NOT EXISTS service_radius_miles integer, ADD COLUMN IF NOT EXISTS public_center_lat double precision, ADD COLUMN IF NOT EXISTS public_center_lng double precision;
CREATE TABLE public.account_security_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, sender_mfn_id text, workspace_id uuid REFERENCES public.workspaces(id), workspace_mfn_id text, event_type text NOT NULL, driver_ids uuid[] NOT NULL DEFAULT '{}', range_start date, range_end date, result text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.account_security_audit TO authenticated;
GRANT ALL ON public.account_security_audit TO service_role;
ALTER TABLE public.account_security_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own security audit read" ON public.account_security_audit FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.save_personal_settings(_first text,_last text,_phone text,_preferences jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM user_profiles WHERE user_id=auth.uid() AND status='active' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Active account required'; END IF;
 IF length(trim(_first)) NOT BETWEEN 1 AND 80 OR length(trim(_last)) NOT BETWEEN 1 AND 80 OR length(_phone)>32 OR jsonb_typeof(_preferences)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(_preferences) k WHERE k NOT IN ('in_app','email')) OR jsonb_typeof(_preferences->'in_app')<>'boolean' OR jsonb_typeof(_preferences->'email')<>'boolean' THEN RAISE EXCEPTION 'Invalid personal settings'; END IF;
 UPDATE user_profiles SET first_name=trim(_first),last_name=trim(_last),display_name=trim(_first)||' '||trim(_last),phone=nullif(trim(_phone),''),notification_preferences=_preferences WHERE user_id=auth.uid();
 INSERT INTO account_security_audit(user_id,sender_mfn_id,event_type,result) SELECT user_id,mfn_id,'personal_settings_updated','saved' FROM user_profiles WHERE user_id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.save_personal_settings(text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_personal_settings(text,text,text,jsonb) TO authenticated;
CREATE FUNCTION public.stamp_patient_provider_selection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w workspaces; p provider_network_profiles;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.selected_provider_workspace_id IS DISTINCT FROM OLD.selected_provider_workspace_id OR NEW.selected_provider_mfn_id IS DISTINCT FROM OLD.selected_provider_mfn_id OR NEW.requester_workspace_mfn_id IS DISTINCT FROM OLD.requester_workspace_mfn_id OR NEW.provider_selection_status IS DISTINCT FROM OLD.provider_selection_status THEN
   IF current_setting('myfloridanemt.targeted_response',true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'Provider routing is server controlled'; END IF;
  END IF; RETURN NEW;
 END IF;
 NEW.requester_workspace_mfn_id:=(SELECT mfn_id FROM workspaces WHERE id=NEW.workspace_id);
 IF NEW.selected_provider_workspace_id IS NULL THEN NEW.selected_provider_mfn_id:=NULL; NEW.provider_selection_status:=NULL; RETURN NEW; END IF;
 IF NEW.trip_kind<>'passenger' OR NEW.requester_user_id IS NULL OR NEW.workspace_id IS NULL OR NOT EXISTS(SELECT 1 FROM workspace_members m JOIN workspaces a ON a.id=m.workspace_id JOIN user_profiles u ON u.user_id=m.user_id WHERE m.user_id=NEW.requester_user_id AND m.workspace_id=NEW.workspace_id AND m.removed_at IS NULL AND a.status='active' AND a.account_type IN ('private_pay','facility','hospital') AND u.status='active' AND u.deleted_at IS NULL AND (m.role IN ('owner','admin') OR m.can_create_requests)) THEN RAISE EXCEPTION 'Customer account required for provider selection'; END IF;
 SELECT * INTO w FROM workspaces WHERE id=NEW.selected_provider_workspace_id AND account_type='provider' AND status='active' AND provider_verified AND NOT is_test_account FOR SHARE;
 SELECT * INTO p FROM provider_network_profiles WHERE workspace_id=w.id AND visible AND accepting_connections FOR SHARE;
 IF w.id IS NULL OR p.workspace_id IS NULL OR NOT (NEW.transport_type=ANY(p.service_types) OR (NEW.transport_type='gurney' AND 'stretcher'=ANY(p.service_types))) THEN RAISE EXCEPTION 'Selected provider is no longer eligible'; END IF;
 NEW.selected_provider_mfn_id:=w.mfn_id; NEW.provider_selection_status:='pending';
 RETURN NEW;
END $$;
CREATE TRIGGER stamp_patient_provider_selection BEFORE INSERT OR UPDATE ON public.ride_requests FOR EACH ROW EXECUTE FUNCTION public.stamp_patient_provider_selection();
CREATE FUNCTION public.list_targeted_patient_requests() RETURNS TABLE(id uuid,mfn_id text,pickup_area text,destination_area text,pickup_date date,pickup_time time,transport_type text,selection_status text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.id,r.mfn_id,r.pickup_city,r.dropoff_city,r.pickup_date,r.pickup_time,r.transport_type,r.provider_selection_status FROM ride_requests r WHERE NOT r.is_test AND r.selected_provider_workspace_id IS NOT NULL AND public.network_workspace_access(r.selected_provider_workspace_id,false) AND r.provider_selection_status IN ('pending','accepted','declined') ORDER BY r.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.list_targeted_patient_requests() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_targeted_patient_requests() TO authenticated;
CREATE FUNCTION public.respond_targeted_patient_request(_request uuid,_accept boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r ride_requests;
BEGIN
 SELECT * INTO r FROM ride_requests WHERE id=_request FOR UPDATE;
 IF r.id IS NULL OR r.is_test OR r.provider_selection_status<>'pending' OR NOT public.network_workspace_access(r.selected_provider_workspace_id,true) OR NOT EXISTS(SELECT 1 FROM workspaces WHERE id=r.selected_provider_workspace_id AND status='active' AND provider_verified AND NOT is_test_account) THEN RAISE EXCEPTION 'Targeted request unavailable'; END IF;
 PERFORM set_config('myfloridanemt.targeted_response','on',true);
 UPDATE ride_requests SET provider_selection_status=CASE WHEN _accept THEN 'accepted' ELSE 'declined' END WHERE id=_request;
 INSERT INTO account_security_audit(user_id,sender_mfn_id,workspace_id,workspace_mfn_id,event_type,result) SELECT auth.uid(),u.mfn_id,w.id,w.mfn_id,'targeted_request_response',CASE WHEN _accept THEN 'accepted' ELSE 'declined' END FROM user_profiles u JOIN workspaces w ON w.id=r.selected_provider_workspace_id WHERE u.user_id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.respond_targeted_patient_request(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_targeted_patient_request(uuid,boolean) TO authenticated;
CREATE POLICY "Accepted targeted provider request read" ON public.ride_requests FOR SELECT TO authenticated USING(provider_selection_status='accepted' AND NOT is_test AND public.network_workspace_access(selected_provider_workspace_id,false));
CREATE FUNCTION public.confirm_schedule_email_preview(_drivers uuid[],_start date,_end date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ws uuid; aid uuid;
BEGIN
 SELECT m.workspace_id INTO ws FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id JOIN user_profiles u ON u.user_id=m.user_id WHERE m.user_id=auth.uid() AND m.removed_at IS NULL AND NOT m.is_contractor AND m.role IN ('owner','admin') AND w.account_type='provider' AND w.status='active' AND u.status='active' AND u.deleted_at IS NULL;
 IF ws IS NULL OR (SELECT count(*) FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=auth.uid() AND m.removed_at IS NULL AND NOT m.is_contractor AND m.role IN ('owner','admin') AND w.account_type='provider' AND w.status='active')<>1 OR cardinality(_drivers) NOT BETWEEN 1 AND 500 OR _start IS NULL OR _end IS NULL OR _end<_start OR EXISTS(SELECT 1 FROM unnest(_drivers) d WHERE NOT EXISTS(SELECT 1 FROM drivers WHERE id=d AND workspace_id=ws)) THEN RAISE EXCEPTION 'Authorized drivers and schedule range required'; END IF;
 INSERT INTO account_security_audit(user_id,sender_mfn_id,workspace_id,workspace_mfn_id,event_type,driver_ids,range_start,range_end,result) SELECT auth.uid(),u.mfn_id,w.id,w.mfn_id,'schedule_email_preview',_drivers,_start,_end,'preview_only_sent_0' FROM user_profiles u JOIN workspaces w ON w.id=ws WHERE u.user_id=auth.uid() RETURNING id INTO aid;
 RETURN aid;
END $$;
REVOKE ALL ON FUNCTION public.confirm_schedule_email_preview(uuid[],date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_schedule_email_preview(uuid[],date,date) TO authenticated;
CREATE FUNCTION public.audit_verified_email_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.email IS DISTINCT FROM OLD.email THEN
 INSERT INTO public.account_security_audit(user_id,sender_mfn_id,event_type,result) SELECT NEW.id,mfn_id,'email_change_verified','verified' FROM public.user_profiles WHERE user_id=NEW.id;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER app_audit_verified_email_change AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.audit_verified_email_change();