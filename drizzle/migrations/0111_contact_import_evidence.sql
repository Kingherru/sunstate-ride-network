ALTER TABLE public.csv_import_jobs DROP CONSTRAINT csv_import_jobs_kind_check;
ALTER TABLE public.csv_import_jobs ADD CONSTRAINT csv_import_jobs_kind_check CHECK(kind IN ('passenger','delivery','contacts'));
CREATE OR REPLACE FUNCTION public.import_workspace_contacts(_workspace uuid,_key text,_source text,_rows jsonb,_confirmed boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE job uuid;r jsonb;existing uuid;created integer:=0;merged integer:=0;BEGIN
IF NOT _confirmed OR NOT public.can_manage_account_connections(_workspace) OR NOT public.business_record_access(_workspace,'contacts',NULL,'manage') THEN RAISE EXCEPTION 'Authorized account manager and confirmation required'; END IF;
IF _key!~'^[a-f0-9]{64}$' OR _source NOT IN ('csv','xlsx','pdf') OR jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows)>250 THEN RAISE EXCEPTION 'Invalid import';END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||_key,0));
IF EXISTS(SELECT 1 FROM public.csv_import_jobs WHERE user_id=auth.uid() AND idempotency_key=_key) THEN RETURN jsonb_build_object('duplicateFile',true,'created',0,'merged',0); END IF;
INSERT INTO public.csv_import_jobs(user_id,workspace_id,kind,idempotency_key,total_rows,source_type,status) VALUES(auth.uid(),_workspace,'contacts',_key,jsonb_array_length(_rows),_source,'processing') RETURNING id INTO job;
FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
IF length(trim(coalesce(r->>'company_name','')))=0 AND (length(trim(coalesce(r->>'first_name','')))=0 OR length(trim(coalesce(r->>'last_name','')))=0) THEN RAISE EXCEPTION 'A business name or first and last name required';END IF;
IF coalesce(r->>'email','')<>'' AND r->>'email'!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email';END IF;
IF coalesce(r->>'phone','')<>'' AND length(regexp_replace(r->>'phone','[^0-9]','','g')) NOT BETWEEN 10 AND 15 THEN RAISE EXCEPTION 'Invalid phone';END IF;
IF r->>'contact_type' NOT IN ('personal','patient','caregiver','facility','business','payer','broker','organization') THEN RAISE EXCEPTION 'Invalid contact type';END IF;
IF length(coalesce(r->>'first_name',''))>80 OR length(coalesce(r->>'last_name',''))>80 OR length(coalesce(r->>'company_name',''))>160 OR length(coalesce(r->>'email',''))>255 OR length(coalesce(r->>'phone',''))>32 OR length(coalesce(r->>'relationship',''))>80 THEN RAISE EXCEPTION 'Contact field too long';END IF;
SELECT id INTO existing FROM public.provider_contacts WHERE workspace_id=_workspace AND active AND ((coalesce(r->>'email','')<>'' AND lower(email)=lower(r->>'email')) OR (coalesce(r->>'phone','')<>'' AND regexp_replace(phone,'[^0-9]','','g')=regexp_replace(r->>'phone','[^0-9]','','g')) OR (lower(first_name)=lower(coalesce(r->>'first_name','')) AND lower(last_name)=lower(coalesce(r->>'last_name','')) AND lower(company_name)=lower(coalesce(r->>'company_name','')))) LIMIT 1;
IF existing IS NOT NULL THEN IF r->>'mergeId' IS DISTINCT FROM existing::text THEN RAISE EXCEPTION 'Possible duplicate requires explicit merge review';END IF;merged:=merged+1;
ELSE
INSERT INTO public.provider_contacts(owner_id,contact_type,first_name,last_name,company_name,phone,email,relationship,payer,contact_roles) VALUES(auth.uid(),r->>'contact_type',coalesce(r->>'first_name',''),coalesce(r->>'last_name',''),coalesce(r->>'company_name',''),coalesce(r->>'phone',''),coalesce(r->>'email',''),coalesce(r->>'relationship',''),coalesce(r->>'payer',''),ARRAY(SELECT jsonb_array_elements_text(coalesce(r->'contact_roles','[]'::jsonb))));
IF NOT EXISTS(SELECT 1 FROM public.provider_contacts WHERE created_by=auth.uid() AND workspace_id=_workspace AND lower(email)=lower(coalesce(r->>'email','')) AND first_name=coalesce(r->>'first_name','')) THEN RAISE EXCEPTION 'Import workspace identity mismatch'; END IF;created:=created+1;END IF;
END LOOP;
UPDATE public.csv_import_jobs SET status='completed',submitted_rows=created,failed_rows=0 WHERE id=job;
INSERT INTO public.account_relationship_events(workspace_id,record_id,action,actor_id,details) VALUES(_workspace,job,'contacts_imported',auth.uid(),jsonb_build_object('created',created,'merged',merged,'source',_source));
RETURN jsonb_build_object('duplicateFile',false,'created',created,'merged',merged,'jobId',job); END $$;
REVOKE ALL ON FUNCTION public.import_workspace_contacts(uuid,text,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_workspace_contacts(uuid,text,text,jsonb,boolean) TO authenticated;