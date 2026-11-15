BEGIN;
CREATE TEMP TABLE saved_patients(id uuid,workspace_id uuid,relationship_links jsonb,family_update_preparation jsonb);
CREATE TEMP TABLE provider_contacts(id uuid,workspace_id uuid,active boolean,email text);
CREATE TEMP TABLE account_business_connections(workspace_a uuid,workspace_b uuid,active boolean);
CREATE TEMP TABLE account_relationship_events(workspace_id uuid,record_id uuid,action text,actor_id uuid,person_mfn_id text,workspace_mfn_id text,details jsonb);
CREATE TEMP TABLE user_profiles(user_id uuid,mfn_id text);
CREATE TEMP TABLE workspaces(id uuid,mfn_id text);
CREATE FUNCTION pg_temp.can_manage_account_connections(ws uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT ws='00000000-0000-4000-8000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION pg_temp.save_patient_relationship_preparation(_patient uuid,_links jsonb,_family jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p pg_temp.saved_patients; c pg_temp.provider_contacts; x text; BEGIN
SELECT * INTO p FROM pg_temp.saved_patients WHERE id=_patient FOR UPDATE;
IF p.id IS NULL OR p.workspace_id IS NULL OR NOT pg_temp.can_manage_account_connections(p.workspace_id) THEN RAISE EXCEPTION 'Patient relationship unavailable'; END IF;
IF jsonb_typeof(_links->'contactIds') IS DISTINCT FROM 'array' OR jsonb_typeof(_links->'businessIds') IS DISTINCT FROM 'array' OR jsonb_array_length(_links->'contactIds')>30 OR jsonb_array_length(_links->'businessIds')>30 THEN RAISE EXCEPTION 'Invalid relationship selection'; END IF;
FOR x IN SELECT jsonb_array_elements_text(_links->'contactIds') LOOP IF NOT EXISTS(SELECT 1 FROM pg_temp.provider_contacts WHERE id=x::uuid AND workspace_id=p.workspace_id AND active) THEN RAISE EXCEPTION 'Related record unavailable'; END IF; END LOOP;
FOR x IN SELECT jsonb_array_elements_text(_links->'businessIds') LOOP IF NOT EXISTS(SELECT 1 FROM pg_temp.account_business_connections WHERE active AND ((workspace_a=p.workspace_id AND workspace_b=x::uuid) OR (workspace_b=p.workspace_id AND workspace_a=x::uuid))) THEN RAISE EXCEPTION 'Related record unavailable'; END IF; END LOOP;
IF _family IS NOT NULL AND coalesce((_family->>'enabled')::boolean,false) THEN
IF _family->>'consentBasis' NOT IN ('patient','authorized_representative') OR length(trim(coalesce(_family->>'consentReference','')))<3 OR _family->>'reviewConfirmed' IS DISTINCT FROM 'true' OR _family->>'recipientConfirmed' IS DISTINCT FROM 'true' OR jsonb_typeof(_family->'categories') IS DISTINCT FROM 'array' OR jsonb_array_length(_family->'categories')=0 OR jsonb_typeof(_family->'fields') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Explicit consent and review required'; END IF;
SELECT * INTO c FROM pg_temp.provider_contacts WHERE id=(_family->>'contactId')::uuid AND workspace_id=p.workspace_id AND active AND id::text IN (SELECT jsonb_array_elements_text(_links->'contactIds'));
IF c.id IS NULL OR coalesce(c.email,'')='' THEN RAISE EXCEPTION 'Recipient unavailable'; END IF;
FOR x IN SELECT jsonb_array_elements_text(_family->'categories') LOOP IF x NOT IN ('upcoming','history') THEN RAISE EXCEPTION 'Invalid notification category'; END IF; END LOOP;
FOR x IN SELECT jsonb_array_elements_text(_family->'fields') LOOP IF x NOT IN ('reference','status','pickup_date','pickup_time') THEN RAISE EXCEPTION 'Invalid information selection'; END IF; END LOOP;
_family:=(_family-'emailConfirmed'-'deliveryEnabled'-'email')||jsonb_build_object('emailConfirmed',false,'deliveryEnabled',false,'recipientEmail',c.email,'recordedAt',now(),'recordedBy','00000000-0000-4000-8000-000000000099'::uuid,'state','prepared_email_confirmation_required');
END IF;
UPDATE pg_temp.saved_patients SET relationship_links=jsonb_build_object('contactIds',_links->'contactIds','businessIds',_links->'businessIds'),family_update_preparation=_family WHERE id=p.id;
INSERT INTO pg_temp.account_relationship_events(workspace_id,record_id,action,actor_id,person_mfn_id,workspace_mfn_id,details) VALUES(p.workspace_id,p.id,CASE WHEN _family IS NULL OR _family->>'enabled'='false' THEN 'patient_relationships_saved_family_revoked' ELSE 'patient_family_updates_prepared' END,'00000000-0000-4000-8000-000000000099'::uuid,(SELECT mfn_id FROM pg_temp.user_profiles WHERE user_id='00000000-0000-4000-8000-000000000099'::uuid),(SELECT mfn_id FROM pg_temp.workspaces WHERE id=p.workspace_id),jsonb_build_object('links',_links,'family',_family,'deliveryEnabled',false));
END $$;

INSERT INTO pg_temp.saved_patients VALUES('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000001','{}',null),('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000002','{}',null);
INSERT INTO pg_temp.provider_contacts VALUES('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000001',true,'synthetic@example.invalid'),('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000002',true,'other@example.invalid');
DO $$ DECLARE failed boolean; links jsonb:='{"contactIds":["00000000-0000-4000-8000-000000000020"],"businessIds":[]}'; family jsonb:='{"enabled":true,"contactId":"00000000-0000-4000-8000-000000000020","consentBasis":"patient","consentReference":"Synthetic consent","reviewConfirmed":true,"recipientConfirmed":true,"categories":["upcoming"],"fields":["reference","status"],"emailConfirmed":true,"deliveryEnabled":true}';BEGIN
PERFORM pg_temp.save_patient_relationship_preparation('00000000-0000-4000-8000-000000000010',links,family);
IF NOT EXISTS(SELECT 1 FROM pg_temp.saved_patients WHERE id='00000000-0000-4000-8000-000000000010' AND family_update_preparation->>'emailConfirmed'='false' AND family_update_preparation->>'deliveryEnabled'='false') THEN RAISE EXCEPTION 'Consent must not confirm email or delivery';END IF;
failed:=false;BEGIN PERFORM pg_temp.save_patient_relationship_preparation('00000000-0000-4000-8000-000000000011',links,family);EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Foreign patient accepted';END IF;
failed:=false;BEGIN PERFORM pg_temp.save_patient_relationship_preparation('00000000-0000-4000-8000-000000000010','{"contactIds":["00000000-0000-4000-8000-000000000021"],"businessIds":[]}',NULL);EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Foreign contact accepted';END IF;
failed:=false;BEGIN PERFORM pg_temp.save_patient_relationship_preparation('00000000-0000-4000-8000-000000000010',links,family||'{"reviewConfirmed":false}');EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Unreviewed consent accepted';END IF;
PERFORM pg_temp.save_patient_relationship_preparation('00000000-0000-4000-8000-000000000010',links,NULL);
IF EXISTS(SELECT 1 FROM pg_temp.saved_patients WHERE family_update_preparation IS NOT NULL) THEN RAISE EXCEPTION 'Revocation failed';END IF;
IF (SELECT count(*) FROM pg_temp.account_relationship_events)<>2 THEN RAISE EXCEPTION 'Audit evidence missing';END IF;
RAISE NOTICE 'Six isolated patient relationship assertions passed';END $$;
ROLLBACK;
