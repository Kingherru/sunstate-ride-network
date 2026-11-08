CREATE OR REPLACE FUNCTION public.account_profile_evidence_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; source_ws uuid; target_ws uuid; e jsonb; prior jsonb;
BEGIN
IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
IF TG_TABLE_NAME='workspaces' THEN source_ws:=NEW.id; ELSIF TG_TABLE_NAME='saved_patients' THEN uid:=NEW.owner_id; ELSIF TG_TABLE_NAME='users' THEN uid:=NEW.id; ELSE uid:=NEW.user_id; END IF;
FOR target_ws IN SELECT w.id FROM public.workspaces w WHERE (w.id=source_ws OR EXISTS(SELECT 1 FROM public.workspace_members m WHERE m.workspace_id=w.id AND m.user_id=uid AND m.role='owner' AND m.removed_at IS NULL) OR TG_TABLE_NAME='workspace_members' AND w.id=NEW.workspace_id) AND w.account_type IN ('private_pay','facility','hospital') LOOP
 e:=public.account_profile_evidence(target_ws); SELECT account_verification_evidence INTO prior FROM public.workspaces WHERE id=target_ws;
 IF (prior-'evaluated_at'-'source') IS DISTINCT FROM e THEN
  UPDATE public.workspaces SET account_verification_evidence=e||jsonb_build_object('evaluated_at',now(),'source',TG_TABLE_NAME) WHERE id=target_ws;
  INSERT INTO public.account_security_audit(user_id,sender_mfn_id,workspace_id,workspace_mfn_id,event_type,result) VALUES(auth.uid(),(SELECT mfn_id FROM public.user_profiles WHERE user_id=auth.uid()),target_ws,e->>'workspace_mfn_id','account_profile_verification',e::text);
 END IF;
END LOOP;
RETURN NEW;
END $$;