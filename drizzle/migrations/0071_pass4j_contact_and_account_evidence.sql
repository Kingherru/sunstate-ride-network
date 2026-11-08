ALTER TABLE public.provider_contacts ADD COLUMN IF NOT EXISTS relationship text, ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS billing_allowed boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS coordination_allowed boolean NOT NULL DEFAULT false;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS account_verification_evidence jsonb;
COMMENT ON COLUMN public.workspaces.account_verification_evidence IS 'Server-derived Patient/Facility profile evidence only; never authorizes access. Provider verification unchanged.';
CREATE OR REPLACE FUNCTION public.account_profile_evidence(_ws uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.workspaces; p public.user_profiles; l public.member_profiles; s public.saved_patients; email_ok boolean; owners integer; reasons text[] := '{}';
BEGIN
SELECT * INTO w FROM public.workspaces WHERE id=_ws;
IF w.id IS NULL OR w.account_type NOT IN ('private_pay','facility','hospital') THEN RETURN NULL; END IF;
SELECT count(*) INTO owners FROM public.workspace_members WHERE workspace_id=_ws AND role='owner' AND NOT is_contractor AND removed_at IS NULL;
SELECT u.* INTO p FROM public.workspace_members m JOIN public.user_profiles u ON u.user_id=m.user_id WHERE m.workspace_id=_ws AND m.role='owner' AND NOT m.is_contractor AND m.removed_at IS NULL ORDER BY m.created_at LIMIT 1;
SELECT * INTO l FROM public.member_profiles WHERE user_id=p.user_id;
SELECT email_confirmed_at IS NOT NULL INTO email_ok FROM auth.users WHERE id=p.user_id;
IF w.status<>'active' OR w.is_test_account OR p.user_id IS NULL OR p.status<>'active' OR p.is_test_account OR p.deleted_at IS NOT NULL THEN reasons:=array_append(reasons,'account_inactive'); END IF;
IF owners<>1 THEN reasons:=array_append(reasons,'primary_owner_required'); END IF;
IF NOT coalesce(email_ok,false) THEN reasons:=array_append(reasons,'email_confirmation_required'); END IF;
IF length(trim(coalesce(p.first_name,'')))=0 OR length(trim(coalesce(p.last_name,'')))=0 THEN reasons:=array_append(reasons,'owner_name_required'); END IF;
IF p.onboarding_policy_version IS DISTINCT FROM '2026-11-07' OR p.onboarding_policy_accepted_at IS NULL THEN reasons:=array_append(reasons,'current_policy_required'); END IF;
IF w.account_type='private_pay' THEN
 IF length(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g')) NOT BETWEEN 7 AND 15 THEN reasons:=array_append(reasons,'valid_phone_required'); END IF;
 IF coalesce(l.patient_type,'') NOT IN ('self','other') THEN reasons:=array_append(reasons,'patient_choice_required'); END IF;
 SELECT * INTO s FROM public.saved_patients WHERE owner_id=p.user_id AND kind='patient' AND active ORDER BY created_at LIMIT 1;
 IF s.id IS NULL OR length(trim(coalesce(s.first_name,'')))=0 OR length(trim(coalesce(s.last_name,'')))=0 OR coalesce(s.mobility,'') NOT IN ('ambulatory','wheelchair','stretcher') THEN reasons:=array_append(reasons,'patient_transport_details_required'); END IF;
 IF l.patient_type='other' AND length(trim(coalesce(l.patient_relationship,'')))=0 THEN reasons:=array_append(reasons,'authorized_relationship_required'); END IF;
ELSE
 IF length(trim(coalesce(w.display_name,'')))=0 THEN reasons:=array_append(reasons,'business_name_required'); END IF;
 IF coalesce(w.organization_type,'') NOT IN ('general_facility','medical_facility','hospital','broker','insurance_company','group_home','nursing_home','medical_courier','other_organization') THEN reasons:=array_append(reasons,'facility_type_required'); END IF;
 IF length(regexp_replace(coalesce(w.business_phone,''),'[^0-9]','','g')) NOT BETWEEN 7 AND 15 THEN reasons:=array_append(reasons,'valid_phone_required'); END IF;
 IF length(trim(coalesce(w.business_address,'')))<3 THEN reasons:=array_append(reasons,'business_address_required'); END IF;
END IF;
RETURN jsonb_build_object('version','2026-11-08','status',CASE WHEN cardinality(reasons)=0 THEN 'verified' ELSE 'incomplete' END,'reasons',to_jsonb(reasons),'owner_mfn_id',p.mfn_id,'workspace_mfn_id',w.mfn_id);
END $$;
REVOKE ALL ON FUNCTION public.account_profile_evidence(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_profile_evidence(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.account_profile_evidence_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; ws uuid; e jsonb; prior jsonb;
BEGIN
IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
IF TG_TABLE_NAME='workspaces' THEN ws:=NEW.id; ELSE uid:=CASE WHEN TG_TABLE_NAME='saved_patients' THEN NEW.owner_id WHEN TG_TABLE_NAME='users' THEN NEW.id ELSE NEW.user_id END; END IF;
FOR ws IN SELECT w.id FROM public.workspaces w WHERE (w.id=ws OR EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=w.id AND m.user_id=uid AND m.role='owner' AND m.removed_at IS NULL)) AND w.account_type IN ('private_pay','facility','hospital') LOOP
 e:=public.account_profile_evidence(ws); SELECT account_verification_evidence INTO prior FROM public.workspaces WHERE id=ws;
 IF (prior-'evaluated_at'-'source') IS DISTINCT FROM e THEN
  UPDATE public.workspaces SET account_verification_evidence=e||jsonb_build_object('evaluated_at',now(),'source',TG_TABLE_NAME) WHERE id=ws;
  INSERT INTO public.account_security_audit(user_id,sender_mfn_id,workspace_id,workspace_mfn_id,event_type,result) VALUES(auth.uid(),(SELECT mfn_id FROM public.user_profiles WHERE user_id=auth.uid()),ws,e->>'workspace_mfn_id','account_profile_verification',e::text);
 END IF;
END LOOP;
RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_account_profile_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.account_verification_evidence IS DISTINCT FROM OLD.account_verification_evidence AND current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'Server evidence only'; END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_account_profile_evidence BEFORE UPDATE OF account_verification_evidence ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.guard_account_profile_evidence();
CREATE TRIGGER account_profile_workspace_changed AFTER INSERT OR UPDATE OF status,display_name,organization_type,business_phone,business_address ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.account_profile_evidence_changed();
CREATE TRIGGER account_profile_person_changed AFTER INSERT OR UPDATE OF first_name,last_name,phone,status,deleted_at,onboarding_policy_version,onboarding_policy_accepted_at ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.account_profile_evidence_changed();
CREATE TRIGGER account_profile_patient_changed AFTER INSERT OR UPDATE OF first_name,last_name,mobility,active ON public.saved_patients FOR EACH ROW EXECUTE FUNCTION public.account_profile_evidence_changed();
CREATE TRIGGER account_profile_preferences_changed AFTER INSERT OR UPDATE OF patient_type,patient_relationship ON public.member_profiles FOR EACH ROW EXECUTE FUNCTION public.account_profile_evidence_changed();
CREATE TRIGGER account_profile_owner_changed AFTER INSERT OR UPDATE OF role,removed_at,is_contractor ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.account_profile_evidence_changed();
CREATE TRIGGER account_profile_email_changed AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.account_profile_evidence_changed();
CREATE OR REPLACE FUNCTION public.my_account_profile_verification() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(jsonb_agg(public.account_profile_evidence(w.id)), '[]'::jsonb) FROM public.workspaces w JOIN public.workspace_members m ON m.workspace_id=w.id WHERE m.user_id=auth.uid() AND m.removed_at IS NULL AND NOT m.is_contractor AND w.account_type IN ('private_pay','facility','hospital') $$;
REVOKE ALL ON FUNCTION public.my_account_profile_verification() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_account_profile_verification() TO authenticated;
CREATE OR REPLACE FUNCTION public.contact_payer_scope_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE target_ws uuid; BEGIN IF TG_TABLE_NAME='provider_contacts' AND NEW.payer_id IS NOT NULL THEN SELECT workspace_id INTO target_ws FROM public.payers WHERE id=NEW.payer_id AND active; ELSIF TG_TABLE_NAME='payers' AND NEW.linked_contact_id IS NOT NULL THEN SELECT workspace_id INTO target_ws FROM public.provider_contacts WHERE id=NEW.linked_contact_id AND active; ELSE RETURN NEW; END IF; IF target_ws IS NULL OR target_ws IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'Linked record not available'; END IF; RETURN NEW; END $$;
CREATE TRIGGER z_contact_payer_scope_guard BEFORE INSERT OR UPDATE ON public.provider_contacts FOR EACH ROW EXECUTE FUNCTION public.contact_payer_scope_guard();
CREATE TRIGGER z_payer_contact_scope_guard BEFORE INSERT OR UPDATE ON public.payers FOR EACH ROW EXECUTE FUNCTION public.contact_payer_scope_guard();