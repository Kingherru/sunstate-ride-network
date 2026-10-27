ALTER TABLE public.provider_network_profiles ADD COLUMN IF NOT EXISTS verification_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.provider_credentials ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id), ADD COLUMN IF NOT EXISTS business_name text, ADD COLUMN IF NOT EXISTS effective_at date, ADD COLUMN IF NOT EXISTS accuracy_attested_at timestamptz, ADD COLUMN IF NOT EXISTS lifecycle_state text;
ALTER TABLE public.provider_payout_accounts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id), ADD COLUMN IF NOT EXISTS environment text, ADD COLUMN IF NOT EXISTS identity_ready boolean NOT NULL DEFAULT false;
ALTER TABLE public.trip_distributions ADD COLUMN IF NOT EXISTS network_stripe_payment_intent_id text, ADD COLUMN IF NOT EXISTS network_payment_environment text, ADD COLUMN IF NOT EXISTS network_recipient_account_id text, ADD COLUMN IF NOT EXISTS network_payment_observed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS network_intent_unique ON public.trip_distributions(network_payment_environment,network_stripe_payment_intent_id) WHERE network_stripe_payment_intent_id IS NOT NULL;
COMMENT ON COLUMN public.trip_distributions.network_stripe_payment_intent_id IS 'Privileged explicit Network obligation linkage only; ordinary trip payments and browser metadata never establish settlement.';
CREATE FUNCTION public.verification_normalize_name(_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT trim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(_name,'')),'[^a-z0-9 ]',' ','g'),'\m(llc|inc|incorporated|corporation|corp|ltd)\M','','g'),'\s+',' ','g')) $$;
CREATE FUNCTION public.provider_verification_evidence_internal(_workspace uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.workspaces; p public.provider_network_profiles; v jsonb; docs jsonb:='[]'; r record; c public.provider_credentials; ds text; legal text; dba text; owner_id uuid; membership_ok boolean; business_ok boolean; services_ok boolean; connect_ok boolean; documents_ok boolean:=true; compliance_ok boolean; gold_ok boolean; overdue boolean; disputes boolean; level text:='none'; reason text; newest_count integer; eligible_count integer; local_day date:=(now() AT TIME ZONE 'America/New_York')::date;
BEGIN
 SELECT * INTO w FROM public.workspaces WHERE id=_workspace;
 IF w.id IS NULL OR w.account_type<>'provider' OR w.is_test_account THEN RETURN NULL; END IF;
 SELECT * INTO p FROM public.provider_network_profiles WHERE workspace_id=w.id;
 v:=coalesce(p.verification_details,'{}'); legal:=v->>'legal_name'; dba:=v->>'dba';
 SELECT m.user_id INTO owner_id FROM public.workspace_members m JOIN public.user_profiles u ON u.user_id=m.user_id WHERE m.workspace_id=w.id AND m.role='owner' AND NOT m.is_contractor AND m.removed_at IS NULL AND u.status='active' AND u.deleted_at IS NULL ORDER BY m.created_at LIMIT 1;
 membership_ok:=EXISTS(SELECT 1 FROM public.subscriptions s JOIN public.workspace_members m ON m.workspace_id=s.workspace_id AND m.user_id=s.user_id WHERE s.workspace_id=w.id AND m.role='owner' AND NOT m.is_contractor AND m.removed_at IS NULL AND s.environment='live' AND s.price_id='nemt_membership_monthly_v2' AND s.status='active' AND s.current_period_end>now() AND s.membership_invoice_id IS NOT NULL AND s.membership_paid_cents=1000 AND s.membership_currency='usd' AND s.membership_payment_state='succeeded' AND s.membership_paid_at IS NOT NULL);
 business_ok:=coalesce(length(trim(legal))>1 AND length(trim(v->>'representative'))>1 AND v->>'business_type' IN ('corporation','llc','partnership','sole_proprietor','independent_contractor') AND length(trim(v->>'business_address'))>5 AND length(trim(v->>'service_location'))>1 AND (v->>'business_type'='independent_contractor' OR length(trim(v->>'registration_number'))>0) AND v->>'attested'='true' AND w.mfn_id IS NOT NULL AND length(p.business_contact_phone)>0 AND length(p.business_contact_email)>0,false);
 services_ok:=coalesce(cardinality(p.approved_service_types)>0 AND p.service_types && p.approved_service_types AND (cardinality(p.counties)>0 OR cardinality(p.cities)>0 OR cardinality(p.zips)>0 OR p.service_radius_miles>0) AND length(trim(p.hours))>0 AND v ? 'after_hours' AND v ? 'minimum_notice_hours' AND jsonb_array_length(coalesce(v->'accepted_payers','[]'))>0 AND v->>'network_rules_acknowledged'='true' AND EXISTS(SELECT 1 FROM public.vehicles x WHERE x.workspace_id=w.id AND x.status='active'),false);
 connect_ok:=EXISTS(SELECT 1 FROM public.provider_payout_accounts a JOIN public.workspace_members m ON m.workspace_id=w.id AND m.user_id=a.user_id AND m.removed_at IS NULL AND m.role='owner' AND NOT m.is_contractor WHERE a.workspace_id=w.id AND a.environment='live' AND a.status='active' AND a.identity_ready AND a.payouts_enabled AND a.charges_enabled AND a.details_submitted);
 FOR r IN SELECT * FROM (VALUES ('w9','W-9',true,false,false),('general_liability','General liability',true,true,true),('auto_insurance','Commercial automobile insurance',true,true,true),('vehicle_registration','Active vehicle registration',true,true,true),('workers_comp','Workers compensation or exemption',true,true,true),('business_license','Florida registration / DBA',coalesce(v->>'business_type','')<>'independent_contractor',false,false),('transport_permit','Transportation / local permit',coalesce(v->>'local_permit_required','true')='true',true,true),('professional_liability','Professional liability',coalesce(v->>'professional_liability_required','true')='true',true,true),('cargo_insurance','Cargo coverage',coalesce(v->>'cargo_required','true')='true',true,true),('program_credential','Claimed program credentials',coalesce(v->>'program_credentials_required','true')='true',true,true)) AS req(kind,label,applicable,effective_required,expiration_required)
 LOOP
  c:=NULL;
  SELECT * INTO c FROM public.provider_credentials x WHERE x.workspace_id=w.id AND x.kind=r.kind AND EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.user_id=x.provider_user_id AND m.workspace_id=w.id AND m.role='owner' AND NOT m.is_contractor AND m.removed_at IS NULL) ORDER BY x.updated_at DESC,x.id DESC LIMIT 1;
  IF NOT r.applicable THEN ds:='Not Applicable';
  ELSIF c.id IS NULL OR c.accuracy_attested_at IS NULL OR public.verification_normalize_name(c.business_name)='' OR NOT (public.verification_normalize_name(c.business_name)=public.verification_normalize_name(legal) OR (coalesce(dba,'')<>'' AND public.verification_normalize_name(c.business_name)=public.verification_normalize_name(dba))) OR NOT EXISTS(SELECT 1 FROM storage.objects o JOIN storage.buckets b ON b.id=o.bucket_id WHERE b.id='provider-docs' AND NOT b.public AND o.name=c.doc_path AND o.name LIKE 'credentials/'||c.provider_user_id||'/%') OR (r.effective_required AND c.effective_at IS NULL) OR c.effective_at>local_day OR (r.expiration_required AND c.expires_at IS NULL) THEN ds:='Missing';
  ELSIF c.expires_at<local_day THEN ds:='Expired';
  ELSIF c.expires_at<=local_day+30 THEN ds:='Expiring Soon'; ELSE ds:='Complete'; END IF;
  IF ds NOT IN ('Complete','Expiring Soon','Not Applicable') THEN documents_ok:=false; END IF;
  docs:=docs||jsonb_build_array(jsonb_build_object('kind',r.kind,'label',r.label,'status',ds));
 END LOOP;
 compliance_ok:=w.status='active' AND owner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.member_profiles m JOIN public.provider_applications a ON a.id=m.provider_application_id WHERE m.user_id=owner_id AND coalesce(a.compliance_status,'') NOT IN ('','compliant','clear','approved','active'));
 overdue:=EXISTS(SELECT 1 FROM public.trip_distributions d WHERE d.source_workspace_id=w.id AND d.payment_due_at<now() AND (d.payment_initiated_at IS NULL OR d.network_payment_state='failed') AND d.network_payment_state NOT IN ('paid','refunded') AND NOT(d.dispute_opened_at IS NOT NULL AND d.dispute_resolved_at IS NULL));
 disputes:=EXISTS(SELECT 1 FROM public.trip_distributions d WHERE (d.source_workspace_id=w.id OR d.selected_workspace_id=w.id) AND d.dispute_opened_at IS NOT NULL AND d.dispute_resolved_at IS NULL);
 SELECT count(*),count(*) FILTER(WHERE network_payment_state='paid' AND network_payment_environment='live' AND network_stripe_payment_intent_id IS NOT NULL AND network_recipient_account_id IS NOT NULL AND payment_completed_at IS NOT NULL AND payment_initiated_at>=network_completed_at AND payment_initiated_at<=payment_due_at) INTO newest_count,eligible_count FROM (SELECT DISTINCT ON (d.trip_id) d.* FROM public.trip_distributions d JOIN public.trips t ON t.id=d.trip_id JOIN public.workspaces rw ON rw.id=d.selected_workspace_id WHERE d.source_workspace_id=w.id AND d.status='accepted' AND t.status='completed' AND d.network_completed_at IS NOT NULL AND d.completion_information_submitted_at IS NOT NULL AND NOT rw.is_test_account ORDER BY d.trip_id,d.network_completed_at DESC) q;
 SELECT count(*) FILTER(WHERE q.network_payment_state='paid' AND q.network_payment_environment='live' AND q.network_stripe_payment_intent_id IS NOT NULL AND q.network_recipient_account_id IS NOT NULL AND q.payment_completed_at IS NOT NULL AND q.payment_initiated_at>=q.network_completed_at AND q.payment_initiated_at<=q.payment_due_at) INTO eligible_count FROM (SELECT DISTINCT ON (d.trip_id) d.* FROM public.trip_distributions d JOIN public.trips t ON t.id=d.trip_id JOIN public.workspaces rw ON rw.id=d.selected_workspace_id WHERE d.source_workspace_id=w.id AND d.status='accepted' AND t.status='completed' AND d.network_completed_at IS NOT NULL AND d.completion_information_submitted_at IS NOT NULL AND NOT rw.is_test_account ORDER BY d.trip_id,d.network_completed_at DESC) z CROSS JOIN LATERAL (SELECT z.*) q WHERE q.id IN (SELECT d.id FROM public.trip_distributions d JOIN public.trips t ON t.id=d.trip_id WHERE d.source_workspace_id=w.id AND d.status='accepted' AND t.status='completed' AND d.network_completed_at IS NOT NULL AND d.completion_information_submitted_at IS NOT NULL ORDER BY d.network_completed_at DESC,d.trip_id LIMIT 5);
 gold_ok:=newest_count>=5 AND eligible_count=5 AND NOT overdue AND NOT disputes;
 IF membership_ok AND compliance_ok THEN level:='semi'; END IF;
 IF level='semi' AND business_ok AND services_ok AND connect_ok AND documents_ok THEN level:='blue'; END IF;
 IF level='blue' AND gold_ok THEN level:='gold'; END IF;
 reason:=CASE WHEN w.verification_paused_reason LIKE 'admin_%' THEN w.verification_paused_reason WHEN NOT compliance_ok THEN 'account_or_compliance_not_active' WHEN NOT membership_ok THEN 'membership_not_current_or_paid' WHEN NOT business_ok THEN 'business_details_missing' WHEN NOT services_ok THEN 'service_requirements_missing' WHEN NOT connect_ok THEN 'stripe_identity_or_payout_not_ready' WHEN NOT documents_ok THEN 'document_requirements_missing_or_expired' WHEN overdue THEN 'network_payment_overdue' WHEN disputes THEN 'active_network_dispute' WHEN NOT gold_ok THEN 'five_recent_on_time_network_payments_required' ELSE NULL END;
 IF w.verification_paused_reason LIKE 'admin_%' THEN level:='none'; END IF;
 RETURN jsonb_build_object('workspace_id',w.id,'level',level,'paused_reason',reason,'requirements',jsonb_build_array(jsonb_build_object('label','Current $10 paid membership','complete',membership_ok),jsonb_build_object('label','Business information','complete',business_ok),jsonb_build_object('label','Services and service area','complete',services_ok),jsonb_build_object('label','Stripe identity and payout readiness','complete',connect_ok),jsonb_build_object('label','Current required documents','complete',documents_ok),jsonb_build_object('label','Active account / compliance','complete',compliance_ok),jsonb_build_object('label','Five recent fully paid, on-time Network trips','complete',gold_ok)),'documents',docs);
END $$;
REVOKE ALL ON FUNCTION public.provider_verification_evidence_internal(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provider_verification_evidence_internal(uuid) TO service_role;
CREATE FUNCTION public.provider_verification_summary(_workspace uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT (public.is_provider_workspace_manager(_workspace,auth.uid()) OR (public.admin_can('membership','read') AND public.admin_can_account(_workspace))) THEN RAISE EXCEPTION 'Verification evidence permission required'; END IF; RETURN public.provider_verification_evidence_internal(_workspace); END $$;
REVOKE ALL ON FUNCTION public.provider_verification_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.provider_verification_summary(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.recalculate_membership_verification(_workspace uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.workspaces; e jsonb; level text; reason text;
BEGIN
 SELECT * INTO w FROM public.workspaces WHERE id=_workspace FOR UPDATE;
 IF w.id IS NULL OR w.account_type<>'provider' OR w.is_test_account THEN RETURN; END IF;
 e:=public.provider_verification_evidence_internal(w.id); level:=e->>'level'; reason:=e->>'paused_reason';
 IF w.automatic_verification_level IS NULL AND NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE workspace_id=w.id AND environment='live' AND membership_invoice_id IS NOT NULL) THEN RETURN; END IF;
 IF w.automatic_verification_level IS DISTINCT FROM level OR w.verification_paused_reason IS DISTINCT FROM reason THEN
 UPDATE public.workspaces SET automatic_verification_level=level,verification_paused_reason=reason,verification_updated_at=now() WHERE id=w.id;
 INSERT INTO public.account_security_audit(user_id,sender_mfn_id,workspace_id,workspace_mfn_id,event_type,result) VALUES(coalesce(auth.uid(),w.created_by),(SELECT mfn_id FROM public.user_profiles WHERE user_id=coalesce(auth.uid(),w.created_by)),w.id,w.mfn_id,'verification_level_changed',coalesce(w.automatic_verification_level,'legacy')||'_to_'||level||':'||coalesce(reason,'requirements_complete'));
 END IF;
END $$;
CREATE FUNCTION public.recalculate_provider_evidence_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j jsonb; oldj jsonb; ws uuid; uid uuid;
BEGIN
 j:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END; oldj:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 IF TG_TABLE_NAME='workspaces' THEN IF j->>'status' IS NOT DISTINCT FROM oldj->>'status' THEN RETURN NEW; END IF; ws:=(j->>'id')::uuid;
 ELSIF TG_TABLE_NAME='trip_distributions' THEN PERFORM public.recalculate_membership_verification((j->>'source_workspace_id')::uuid); PERFORM public.recalculate_membership_verification((j->>'selected_workspace_id')::uuid); RETURN NEW;
 ELSE ws:=nullif(j->>'workspace_id','')::uuid; uid:=coalesce(nullif(j->>'provider_user_id',''),nullif(j->>'user_id',''))::uuid; END IF;
 IF ws IS NOT NULL THEN PERFORM public.recalculate_membership_verification(ws); END IF;
 IF uid IS NOT NULL THEN FOR ws IN SELECT workspace_id FROM public.workspace_members WHERE user_id=uid AND removed_at IS NULL AND role='owner' AND NOT is_contractor LOOP PERFORM public.recalculate_membership_verification(ws); END LOOP; END IF;
 IF TG_TABLE_NAME='provider_applications' THEN FOR ws IN SELECT m.workspace_id FROM public.workspace_members m JOIN public.member_profiles mp ON mp.user_id=m.user_id WHERE mp.provider_application_id=(j->>'id')::uuid AND m.role='owner' AND m.removed_at IS NULL LOOP PERFORM public.recalculate_membership_verification(ws); END LOOP; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER provider_profile_recalculate AFTER INSERT OR UPDATE OR DELETE ON public.provider_network_profiles FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_evidence_event();
CREATE TRIGGER provider_document_recalculate AFTER INSERT OR UPDATE OR DELETE ON public.provider_credentials FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_evidence_event();
CREATE TRIGGER provider_connect_recalculate AFTER INSERT OR UPDATE OR DELETE ON public.provider_payout_accounts FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_evidence_event();
CREATE TRIGGER provider_network_recalculate AFTER UPDATE ON public.trip_distributions FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_evidence_event();
CREATE TRIGGER provider_status_recalculate AFTER UPDATE OF status ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_evidence_event();
CREATE TRIGGER provider_person_recalculate AFTER UPDATE ON public.member_profiles FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_evidence_event();
CREATE TRIGGER provider_identity_status_recalculate AFTER UPDATE OF status,deleted_at ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_evidence_event();
CREATE TRIGGER provider_compliance_recalculate AFTER UPDATE OF compliance_status ON public.provider_applications FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_evidence_event();
CREATE TRIGGER provider_vehicle_recalculate AFTER INSERT OR UPDATE OR DELETE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.recalculate_provider_evidence_event();
CREATE FUNCTION public.guard_verification_evidence_linkage() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='provider_credentials' THEN
 IF NEW.accuracy_attested_at IS DISTINCT FROM OLD.accuracy_attested_at AND NEW.accuracy_attested_at IS NOT NULL AND abs(extract(epoch FROM NEW.accuracy_attested_at-now()))>60 THEN RAISE EXCEPTION 'Attestation must be current'; END IF;
 IF NEW.workspace_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=NEW.provider_user_id AND m.role='owner' AND NOT m.is_contractor AND m.removed_at IS NULL) THEN RAISE EXCEPTION 'Document owner business linkage required'; END IF;
 ELSE IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'Stripe evidence linkage is server controlled'; END IF; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER credential_evidence_link_guard BEFORE UPDATE ON public.provider_credentials FOR EACH ROW EXECUTE FUNCTION public.guard_verification_evidence_linkage();
CREATE TRIGGER payout_evidence_link_guard BEFORE UPDATE OF workspace_id,environment,identity_ready ON public.provider_payout_accounts FOR EACH ROW EXECUTE FUNCTION public.guard_verification_evidence_linkage();
CREATE FUNCTION public.network_evidence_link_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'Network Stripe linkage is server controlled'; END IF; RETURN NEW; END $$;
CREATE TRIGGER network_evidence_link_guard BEFORE UPDATE OF network_stripe_payment_intent_id,network_payment_environment,network_recipient_account_id,network_payment_observed_at ON public.trip_distributions FOR EACH ROW EXECUTE FUNCTION public.network_evidence_link_guard();
CREATE FUNCTION public.provider_verification_lifecycle() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; d record; w record; next_state text; changed integer:=0; local_day date:=(now() AT TIME ZONE 'America/New_York')::date;
BEGIN
 IF NOT pg_try_advisory_xact_lock(742301) THEN RETURN jsonb_build_object('skipped',true); END IF;
 FOR c IN SELECT * FROM public.provider_credentials WHERE workspace_id IS NOT NULL AND expires_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.workspaces WHERE id=workspace_id AND NOT is_test_account) LOOP
 next_state:=CASE WHEN c.expires_at<local_day THEN 'expired' WHEN c.expires_at<=local_day+30 THEN 'expiring_soon' ELSE 'current' END;
 IF c.lifecycle_state IS DISTINCT FROM next_state THEN UPDATE public.provider_credentials SET lifecycle_state=next_state WHERE id=c.id; changed:=changed+1;
 INSERT INTO public.account_security_audit(user_id,sender_mfn_id,workspace_id,workspace_mfn_id,event_type,result) SELECT c.provider_user_id,p.mfn_id,c.workspace_id,w.mfn_id,'document_lifecycle_changed',next_state FROM public.user_profiles p JOIN public.workspaces w ON w.id=c.workspace_id WHERE p.user_id=c.provider_user_id;
 IF next_state<>'current' THEN INSERT INTO public.notifications(user_id,type,title,body,link) VALUES(c.provider_user_id,'verification_requirement','Document requirement '||replace(next_state,'_',' '),'Sign in to review your document checklist.','/portal/account'); END IF;
 END IF; END LOOP;
 FOR d IN SELECT * FROM public.trip_distributions WHERE network_completed_at IS NOT NULL AND payment_due_at<now() AND (payment_initiated_at IS NULL OR network_payment_state='failed') AND network_payment_state NOT IN ('paid','refunded','overdue') AND NOT(dispute_opened_at IS NOT NULL AND dispute_resolved_at IS NULL) AND EXISTS(SELECT 1 FROM public.workspaces WHERE id=source_workspace_id AND NOT is_test_account) FOR UPDATE LOOP
 UPDATE public.trip_distributions SET network_payment_state='overdue',updated_at=now() WHERE id=d.id; changed:=changed+1;
 PERFORM public.network_audit(d.id,d.selected_offer_id,'network_payment_overdue',jsonb_build_object('due_at',d.payment_due_at));
 PERFORM public.network_notify(d.source_workspace_id,'Network payment overdue',d.selected_offer_id,true);
 END LOOP;
 FOR w IN SELECT id FROM public.workspaces WHERE account_type='provider' AND NOT is_test_account AND (automatic_verification_level IS NOT NULL OR EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.workspace_id=workspaces.id AND s.environment='live' AND s.membership_invoice_id IS NOT NULL)) LOOP PERFORM public.recalculate_membership_verification(w.id); END LOOP;
 RETURN jsonb_build_object('changed',changed);
END $$;
REVOKE ALL ON FUNCTION public.provider_verification_lifecycle() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provider_verification_lifecycle() TO service_role;
COMMENT ON FUNCTION public.provider_verification_lifecycle() IS 'Prepared only, not scheduled: hourly SQL cron invocation requires owner activation because database also serves production. Auth expiration is not inferred without authoritative hosted TTL.';