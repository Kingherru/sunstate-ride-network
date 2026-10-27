ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id), ADD COLUMN IF NOT EXISTS membership_invoice_id text, ADD COLUMN IF NOT EXISTS membership_paid_cents integer, ADD COLUMN IF NOT EXISTS membership_currency text, ADD COLUMN IF NOT EXISTS membership_payment_state text, ADD COLUMN IF NOT EXISTS membership_paid_at timestamptz;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS automatic_verification_level text, ADD COLUMN IF NOT EXISTS verification_paused_reason text, ADD COLUMN IF NOT EXISTS verification_updated_at timestamptz;
COMMENT ON COLUMN public.workspaces.automatic_verification_level IS 'Server-derived automatic level. NULL preserves legacy directory verification; semi requires authoritative live membership invoice. Blue/gold remain unavailable until full evidence linkage.';
CREATE FUNCTION public.guard_automatic_verification() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role') AND (NEW.automatic_verification_level IS DISTINCT FROM OLD.automatic_verification_level OR NEW.verification_paused_reason IS DISTINCT FROM OLD.verification_paused_reason OR NEW.verification_updated_at IS DISTINCT FROM OLD.verification_updated_at) THEN RAISE EXCEPTION 'Verification is server controlled'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_automatic_verification BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.guard_automatic_verification();
CREATE FUNCTION public.recalculate_membership_verification(_workspace uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.workspaces; level text; reason text;
BEGIN
 SELECT * INTO w FROM public.workspaces WHERE id=_workspace FOR UPDATE;
 IF w.id IS NULL OR w.account_type<>'provider' OR w.is_test_account THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE workspace_id=w.id AND environment='live' AND membership_invoice_id IS NOT NULL) THEN RETURN; END IF;
 IF w.verification_paused_reason LIKE 'admin_%' THEN RETURN; END IF;
 IF w.status='active' AND EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.workspace_id=w.id AND s.environment='live' AND s.price_id='nemt_membership_monthly_v2' AND s.status='active' AND s.current_period_end>now() AND s.membership_paid_cents=1000 AND s.membership_currency='usd' AND s.membership_payment_state='succeeded' AND s.membership_paid_at IS NOT NULL) THEN level:='semi'; reason:=NULL; ELSE level:='none'; reason:='membership_not_current_or_paid'; END IF;
 IF w.automatic_verification_level IS DISTINCT FROM level OR w.verification_paused_reason IS DISTINCT FROM reason THEN
  UPDATE public.workspaces SET automatic_verification_level=level,verification_paused_reason=reason,verification_updated_at=now() WHERE id=w.id;
  INSERT INTO public.account_security_audit(user_id,sender_mfn_id,workspace_id,workspace_mfn_id,event_type,result) VALUES(w.created_by,(SELECT mfn_id FROM public.user_profiles WHERE user_id=auth.uid()),w.id,w.mfn_id,'verification_level_changed',coalesce(w.automatic_verification_level,'legacy')||'_to_'||level||':'||coalesce(reason,'successful_current_membership'));
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.recalculate_membership_verification(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_membership_verification(uuid) TO service_role;
CREATE FUNCTION public.audit_membership_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.workspace_id IS NOT NULL AND NEW.environment='live' AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.membership_invoice_id IS DISTINCT FROM OLD.membership_invoice_id OR NEW.membership_payment_state IS DISTINCT FROM OLD.membership_payment_state OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end) THEN
  INSERT INTO public.account_security_audit(user_id,sender_mfn_id,workspace_id,workspace_mfn_id,event_type,result) SELECT NEW.user_id,(SELECT mfn_id FROM public.user_profiles WHERE user_id=auth.uid()),NEW.workspace_id,w.mfn_id,'membership_payment_status_changed',NEW.status||':'||coalesce(NEW.membership_payment_state,'unknown') FROM public.workspaces w WHERE w.id=NEW.workspace_id;
 END IF;
 IF NEW.workspace_id IS NOT NULL THEN PERFORM public.recalculate_membership_verification(NEW.workspace_id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER audit_membership_evidence AFTER INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.audit_membership_evidence();
CREATE FUNCTION public.provider_verification_badges(_workspaces uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('workspace_id',w.id,'level',CASE WHEN w.automatic_verification_level='semi' AND (w.status<>'active' OR NOT EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.workspace_id=w.id AND s.environment='live' AND s.price_id='nemt_membership_monthly_v2' AND s.status='active' AND s.current_period_end>now() AND s.membership_paid_cents=1000 AND s.membership_currency='usd' AND s.membership_payment_state='succeeded')) THEN 'none' ELSE w.automatic_verification_level END,'legacy_verified',w.provider_verified,'paused_reason',CASE WHEN public.network_workspace_access(w.id,false) OR (public.admin_can('membership','read') AND public.admin_can_account(w.id)) THEN w.verification_paused_reason ELSE NULL END)),'[]'::jsonb) FROM public.workspaces w WHERE w.id=ANY(_workspaces) AND w.account_type='provider' AND NOT w.is_test_account AND (public.network_workspace_access(w.id,false) OR (public.admin_can('membership','read') AND public.admin_can_account(w.id)) OR (w.status='active' AND w.provider_verified AND EXISTS(SELECT 1 FROM public.provider_network_profiles p WHERE p.workspace_id=w.id AND p.visible)))
$$;
REVOKE ALL ON FUNCTION public.provider_verification_badges(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.provider_verification_badges(uuid[]) TO authenticated;
CREATE FUNCTION public.admin_pause_provider_badge(_workspace uuid,_category text,_reason text,_confirmed boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.workspaces;
BEGIN
 SELECT * INTO w FROM public.workspaces WHERE id=_workspace FOR UPDATE;
 IF w.id IS NULL OR w.account_type<>'provider' OR _category IS NULL OR _category NOT IN ('payment','compliance','security') OR _reason IS NULL OR length(trim(_reason))<10 OR length(_reason)>500 OR NOT coalesce(_confirmed,false) OR NOT public.admin_can('membership','manage') OR NOT public.admin_can_account(w.id) OR EXISTS(SELECT 1 FROM public.platform_master_admin ma JOIN public.workspace_members m ON m.user_id=ma.user_id WHERE m.workspace_id=w.id AND m.removed_at IS NULL AND m.role='owner') THEN RAISE EXCEPTION 'Scoped billing permission and documented confirmation required; Master Admin protected'; END IF;
 UPDATE public.workspaces SET automatic_verification_level='none',verification_paused_reason='admin_'||_category,verification_updated_at=now() WHERE id=w.id;
 INSERT INTO public.account_security_audit(user_id,sender_mfn_id,workspace_id,workspace_mfn_id,event_type,result) VALUES(auth.uid(),(SELECT mfn_id FROM public.user_profiles WHERE user_id=auth.uid()),w.id,w.mfn_id,'verification_badge_paused',_category||':'||trim(_reason));
END $$;
REVOKE ALL ON FUNCTION public.admin_pause_provider_badge(uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_pause_provider_badge(uuid,text,text,boolean) TO authenticated;