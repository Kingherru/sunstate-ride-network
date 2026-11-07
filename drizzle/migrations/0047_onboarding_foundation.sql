ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_step integer, ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS legal_business_name text, ADD COLUMN IF NOT EXISTS business_phone text, ADD COLUMN IF NOT EXISTS dispatch_phone text, ADD COLUMN IF NOT EXISTS business_address text, ADD COLUMN IF NOT EXISTS operating_hours text;
CREATE OR REPLACE FUNCTION public.complete_account_setup()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid:=auth.uid(); _meta jsonb; _confirmed timestamptz; _type text; _org text; _name text; _phone text; _ws uuid;
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT raw_user_meta_data,email_confirmed_at INTO _meta,_confirmed FROM auth.users WHERE id=_uid;
 IF _confirmed IS NULL THEN RAISE EXCEPTION 'email_not_verified'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=_uid AND (status='suspended' OR deleted_at IS NOT NULL OR is_test_account)) THEN RAISE EXCEPTION 'account_unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text,0));
 _type:=_meta->>'account_type'; _name:=left(btrim(coalesce(_meta->>'display_name',_meta->>'full_name','')),120); _phone:=left(nullif(btrim(coalesce(_meta->>'phone','')),''),32); _org:=left(btrim(coalesce(_meta->>'organization_name','')),160);
 INSERT INTO public.user_profiles(user_id,display_name,phone,legacy_review_needed) VALUES(_uid,_name,_phone,_type IS NULL) ON CONFLICT(user_id) DO NOTHING;
 IF _type IS NULL OR _type NOT IN ('private_pay','facility','hospital','provider') THEN RETURN jsonb_build_object('workspace_id',NULL); END IF;
 SELECT workspace_id INTO _ws FROM public.workspace_members WHERE user_id=_uid LIMIT 1;
 IF _ws IS NOT NULL THEN RETURN jsonb_build_object('workspace_id',_ws); END IF;
 IF _type<>'private_pay' AND _org='' THEN RAISE EXCEPTION 'organization_required'; END IF;
 INSERT INTO public.workspaces(account_type,display_name,status,created_by) VALUES(_type::public.workspace_type,CASE WHEN _type='private_pay' THEN coalesce(nullif(_name,''),'Private Pay') ELSE _org END,'active',_uid) RETURNING id INTO _ws;
 INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES(_ws,_uid,'owner');
 UPDATE public.user_profiles SET legacy_review_needed=false,onboarding_step=0 WHERE user_id=_uid;
 RETURN jsonb_build_object('workspace_id',_ws);
END $$;
REVOKE ALL ON FUNCTION public.complete_account_setup() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_account_setup() TO authenticated;
CREATE FUNCTION public.save_onboarding_progress(_step integer,_complete boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _step NOT BETWEEN 0 AND 4 OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id=auth.uid() AND status='active' AND deleted_at IS NULL AND NOT is_test_account) THEN RAISE EXCEPTION 'Setup unavailable'; END IF;
 UPDATE public.user_profiles SET onboarding_step=_step,onboarding_completed_at=CASE WHEN _complete THEN now() ELSE onboarding_completed_at END WHERE user_id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.save_onboarding_progress(integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_progress(integer,boolean) TO authenticated;
COMMENT ON COLUMN public.user_profiles.onboarding_step IS 'Optional resumable presentation progress only; never an authorization or verification gate. NULL preserves established accounts.';
COMMENT ON COLUMN public.workspaces.business_address IS 'Private business contact address, never a public proximity center.';