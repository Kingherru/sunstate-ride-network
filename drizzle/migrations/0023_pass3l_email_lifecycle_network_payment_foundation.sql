ALTER TABLE public.account_security_audit ADD COLUMN IF NOT EXISTS correlation_id uuid;
CREATE INDEX IF NOT EXISTS account_security_audit_correlation_idx ON public.account_security_audit(correlation_id);
CREATE OR REPLACE FUNCTION public.audit_verified_email_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid; last_type text;
BEGIN
 SELECT correlation_id,event_type INTO cid,last_type FROM public.account_security_audit WHERE user_id=NEW.id AND event_type LIKE 'email_change_%' ORDER BY created_at DESC,id DESC LIMIT 1;
 IF NEW.email IS DISTINCT FROM OLD.email THEN
  INSERT INTO public.account_security_audit(user_id,sender_mfn_id,event_type,result,correlation_id) SELECT NEW.id,mfn_id,'email_change_confirmed','confirmed',cid FROM public.user_profiles WHERE user_id=NEW.id;
 ELSIF coalesce(NEW.email_change,'')<>'' AND (NEW.email_change IS DISTINCT FROM OLD.email_change OR NEW.email_change_sent_at IS DISTINCT FROM OLD.email_change_sent_at) THEN
  INSERT INTO public.account_security_audit(user_id,sender_mfn_id,event_type,result,correlation_id) SELECT NEW.id,mfn_id,'email_change_requested','requested',gen_random_uuid() FROM public.user_profiles WHERE user_id=NEW.id;
 ELSIF coalesce(OLD.email_change,'')<>'' AND coalesce(NEW.email_change,'')='' AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
  INSERT INTO public.account_security_audit(user_id,sender_mfn_id,event_type,result,correlation_id) SELECT NEW.id,mfn_id,'email_change_canceled','canceled',cid FROM public.user_profiles WHERE user_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER app_audit_email_change_pending AFTER UPDATE OF email_change,email_change_sent_at ON auth.users FOR EACH ROW WHEN (NEW.email IS NOT DISTINCT FROM OLD.email) EXECUTE FUNCTION public.audit_verified_email_change();
CREATE FUNCTION public.audit_email_change_failure(_user uuid,_expired boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.account_security_audit(user_id,sender_mfn_id,event_type,result,correlation_id) SELECT _user,p.mfn_id,CASE WHEN _expired THEN 'email_change_expired' ELSE 'email_change_failed' END,CASE WHEN _expired THEN 'confirmation_expired' ELSE 'request_failed' END,(SELECT correlation_id FROM public.account_security_audit WHERE user_id=_user AND event_type='email_change_requested' ORDER BY created_at DESC LIMIT 1) FROM public.user_profiles p WHERE p.user_id=_user;
END $$;
REVOKE ALL ON FUNCTION public.audit_email_change_failure(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.audit_email_change_failure(uuid,boolean) TO service_role;
ALTER TABLE public.trip_distributions ADD COLUMN IF NOT EXISTS completion_information_submitted_at timestamptz, ADD COLUMN IF NOT EXISTS network_completed_at timestamptz, ADD COLUMN IF NOT EXISTS payment_due_at timestamptz, ADD COLUMN IF NOT EXISTS network_payment_state text NOT NULL DEFAULT 'pending', ADD COLUMN IF NOT EXISTS payment_initiated_at timestamptz, ADD COLUMN IF NOT EXISTS payment_completed_at timestamptz, ADD COLUMN IF NOT EXISTS dispute_opened_at timestamptz, ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz, ADD COLUMN IF NOT EXISTS dispute_reason_code text;
CREATE FUNCTION public.network_payment_due_at(_completed timestamptz) RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE local_time timestamp:=_completed AT TIME ZONE 'America/New_York'; n integer:=0;
BEGIN IF _completed IS NULL THEN RETURN NULL; END IF; WHILE n<3 LOOP local_time:=local_time+interval '1 day'; IF extract(isodow FROM local_time)<6 THEN n:=n+1; END IF; END LOOP; RETURN local_time AT TIME ZONE 'America/New_York'; END $$;
REVOKE ALL ON FUNCTION public.network_payment_due_at(timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.network_payment_due_at(timestamptz) TO authenticated,service_role;
CREATE FUNCTION public.network_payment_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role') AND (NEW.network_completed_at IS DISTINCT FROM OLD.network_completed_at OR NEW.completion_information_submitted_at IS DISTINCT FROM OLD.completion_information_submitted_at OR NEW.payment_due_at IS DISTINCT FROM OLD.payment_due_at OR NEW.network_payment_state IS DISTINCT FROM OLD.network_payment_state OR NEW.payment_initiated_at IS DISTINCT FROM OLD.payment_initiated_at OR NEW.payment_completed_at IS DISTINCT FROM OLD.payment_completed_at OR NEW.dispute_opened_at IS DISTINCT FROM OLD.dispute_opened_at OR NEW.dispute_resolved_at IS DISTINCT FROM OLD.dispute_resolved_at OR NEW.dispute_reason_code IS DISTINCT FROM OLD.dispute_reason_code) THEN RAISE EXCEPTION 'Network financial state is server controlled'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER network_payment_guard BEFORE UPDATE ON public.trip_distributions FOR EACH ROW EXECUTE FUNCTION public.network_payment_guard();
CREATE FUNCTION public.network_record_completion(_distribution uuid,_confirmed boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.trip_distributions; t public.trips; ts timestamptz:=now();
BEGIN
 SELECT * INTO d FROM public.trip_distributions WHERE id=_distribution FOR UPDATE;
 IF d.id IS NULL OR NOT coalesce(_confirmed,false) OR d.selected_workspace_id IS NULL OR NOT public.network_workspace_access(d.selected_workspace_id,true) OR NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=d.source_workspace_id AND account_type='provider' AND status='active' AND NOT is_test_account) OR NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=d.selected_workspace_id AND account_type='provider' AND status='active' AND NOT is_test_account) THEN RAISE EXCEPTION 'Receiving provider completion permission required'; END IF;
 SELECT * INTO t FROM public.trips WHERE id=d.trip_id FOR UPDATE;
 IF t.id IS NULL OR t.network_distribution_id IS DISTINCT FROM d.id OR t.network_provider_workspace_id IS DISTINCT FROM d.selected_workspace_id OR t.status<>'completed' OR t.completed_at IS NULL THEN RAISE EXCEPTION 'Complete the assigned trip and required completion information first'; END IF;
 IF d.network_completed_at IS NOT NULL THEN RETURN; END IF;
 UPDATE public.trip_distributions SET network_completed_at=ts,completion_information_submitted_at=ts,payment_due_at=public.network_payment_due_at(ts),network_payment_state='due',updated_at=ts WHERE id=d.id;
 PERFORM public.network_audit(d.id,d.selected_offer_id,'network_completion',jsonb_build_object('completed_at',ts,'payment_due_at',public.network_payment_due_at(ts)));
 PERFORM public.network_notify(d.source_workspace_id,'Network trip completed — payment due',d.selected_offer_id,true);
 PERFORM public.network_notify(d.selected_workspace_id,'Network completion recorded',d.selected_offer_id,false);
END $$;
REVOKE ALL ON FUNCTION public.network_record_completion(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.network_record_completion(uuid,boolean) TO authenticated;
CREATE FUNCTION public.network_open_payment_dispute(_distribution uuid,_reason text,_confirmed boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.trip_distributions;
BEGIN
 SELECT * INTO d FROM public.trip_distributions WHERE id=_distribution FOR UPDATE;
 IF d.id IS NULL OR NOT coalesce(_confirmed,false) OR NOT public.network_workspace_access(d.source_workspace_id,true) OR _reason IS NULL OR _reason NOT IN ('completion_missing','service_not_completed','amount_incorrect','security_issue') OR d.network_completed_at IS NULL OR now()>d.network_completed_at+interval '24 hours' OR d.dispute_opened_at IS NOT NULL OR d.network_payment_state IN ('paid','refunded') THEN RAISE EXCEPTION 'Sender permission and a confirmed dispute within 24 hours required'; END IF;
 UPDATE public.trip_distributions SET dispute_opened_at=now(),dispute_reason_code=_reason,network_payment_state='disputed',updated_at=now() WHERE id=d.id;
 PERFORM public.network_audit(d.id,d.selected_offer_id,'payment_disputed',jsonb_build_object('reason_code',_reason,'opened_at',now()));
 PERFORM public.network_notify(d.source_workspace_id,'Network payment disputed',d.selected_offer_id,true);
 PERFORM public.network_notify(d.selected_workspace_id,'Network payment disputed',d.selected_offer_id,true);
END $$;
REVOKE ALL ON FUNCTION public.network_open_payment_dispute(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.network_open_payment_dispute(uuid,text,boolean) TO authenticated;
CREATE FUNCTION public.network_resolve_payment_dispute(_distribution uuid,_reason text,_confirmed boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.trip_distributions;
BEGIN
 SELECT * INTO d FROM public.trip_distributions WHERE id=_distribution FOR UPDATE;
 IF d.id IS NULL OR NOT coalesce(_confirmed,false) OR _reason IS NULL OR length(trim(_reason))<10 OR length(_reason)>500 OR NOT public.admin_can('membership','manage') OR NOT public.admin_can_account(d.source_workspace_id) OR NOT public.admin_can_account(d.selected_workspace_id) OR d.dispute_opened_at IS NULL OR d.dispute_resolved_at IS NOT NULL THEN RAISE EXCEPTION 'Scoped billing permission, documented reason and confirmation required'; END IF;
 UPDATE public.trip_distributions SET dispute_resolved_at=now(),payment_due_at=payment_due_at+(now()-dispute_opened_at),network_payment_state='resolved',updated_at=now() WHERE id=d.id;
 PERFORM public.network_audit(d.id,d.selected_offer_id,'payment_dispute_resolved',jsonb_build_object('reason',trim(_reason),'resolved_at',now(),'payment_due_at',d.payment_due_at+(now()-d.dispute_opened_at)));
 PERFORM public.network_notify(d.source_workspace_id,'Network payment dispute resolved',d.selected_offer_id,true);
 PERFORM public.network_notify(d.selected_workspace_id,'Network payment dispute resolved',d.selected_offer_id,true);
END $$;
REVOKE ALL ON FUNCTION public.network_resolve_payment_dispute(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.network_resolve_payment_dispute(uuid,text,boolean) TO authenticated;
CREATE FUNCTION public.network_list_payments() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'mfn_id',d.mfn_id,'source_mfn_id',d.source_mfn_id,'completed_at',d.network_completed_at,'due_at',d.payment_due_at,'initiated_at',d.payment_initiated_at,'paid_at',d.payment_completed_at,'dispute_opened_at',d.dispute_opened_at,'dispute_resolved_at',d.dispute_resolved_at,'state',CASE WHEN d.dispute_opened_at IS NOT NULL AND d.dispute_resolved_at IS NULL THEN 'disputed' WHEN d.network_payment_state IN ('paid','refunded') THEN d.network_payment_state WHEN d.payment_due_at<now() AND (d.payment_initiated_at IS NULL OR d.network_payment_state='failed') THEN 'overdue' ELSE d.network_payment_state END,'can_complete',public.network_workspace_access(d.selected_workspace_id,true),'can_dispute',public.network_workspace_access(d.source_workspace_id,true),'can_resolve',public.admin_can('membership','manage') AND public.admin_can_account(d.source_workspace_id) AND public.admin_can_account(d.selected_workspace_id)) ORDER BY d.created_at DESC),'[]'::jsonb) FROM public.trip_distributions d WHERE d.selected_workspace_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.workspaces WHERE id=d.source_workspace_id AND account_type='provider' AND NOT is_test_account) AND (public.network_workspace_access(d.source_workspace_id,false) OR public.network_workspace_access(d.selected_workspace_id,false) OR (public.admin_can('membership','read') AND public.admin_can_account(d.source_workspace_id) AND public.admin_can_account(d.selected_workspace_id)))
$$;
REVOKE ALL ON FUNCTION public.network_list_payments() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.network_list_payments() TO authenticated;