ALTER TABLE public.courses ADD COLUMN commerce_catalog_version jsonb;
ALTER TABLE public.subscriptions ADD COLUMN entitlement_version_snapshot jsonb, ADD COLUMN price_effective_through timestamptz;
ALTER TABLE public.provider_payout_accounts ADD COLUMN capability_readiness jsonb, ADD COLUMN disabled_reason_code text;
ALTER TABLE public.network_stripe_events ADD COLUMN preparation_evidence jsonb;
ALTER TABLE public.network_settlement_events ADD COLUMN accounting_evidence jsonb;
COMMENT ON COLUMN public.network_settlement_events.accounting_evidence IS 'Append-only balanced minor-unit accounting preparation tied to existing settlement; no money movement or available-balance authority.';
CREATE FUNCTION public.pass4m_immutable_preparation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_TABLE_NAME='network_settlement_events' AND ((TG_OP='UPDATE' AND OLD.accounting_evidence IS NOT NULL) OR (TG_OP='DELETE' AND OLD.accounting_evidence IS NOT NULL)) THEN RAISE EXCEPTION 'Accounting history is immutable'; END IF;
 IF TG_TABLE_NAME='subscriptions' AND TG_OP='UPDATE' AND OLD.entitlement_version_snapshot IS NOT NULL AND (NEW.entitlement_version_snapshot IS DISTINCT FROM OLD.entitlement_version_snapshot OR NEW.price_effective_through IS DISTINCT FROM OLD.price_effective_through) THEN RAISE EXCEPTION 'Enrolled version is immutable'; END IF;
 IF TG_TABLE_NAME='provider_membership_trials' AND TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Introductory trial history is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE TRIGGER pass4m_accounting_immutable BEFORE UPDATE OR DELETE ON public.network_settlement_events FOR EACH ROW EXECUTE FUNCTION public.pass4m_immutable_preparation();
CREATE TRIGGER pass4m_enrolled_version_immutable BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.pass4m_immutable_preparation();
CREATE TRIGGER pass4m_trial_immutable BEFORE UPDATE OR DELETE ON public.provider_membership_trials FOR EACH ROW EXECUTE FUNCTION public.pass4m_immutable_preparation();
CREATE FUNCTION public.pass4m_reserve_workspace_trial(_workspace uuid,_env text,_subscription text,_started timestamptz) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF current_user NOT IN ('postgres','service_role','supabase_admin') OR _env<>'sandbox' OR NOT EXISTS(SELECT 1 FROM platform_launch_flags WHERE key='pass4m_workspace_trial_reservation' AND enabled) THEN RAISE EXCEPTION 'Trial reservation unavailable'; END IF;
 PERFORM 1 FROM workspaces WHERE id=_workspace AND account_type='provider' AND status='active' AND NOT is_test_account FOR UPDATE;
 IF NOT FOUND OR _subscription IS NULL OR _started IS NULL THEN RAISE EXCEPTION 'Trial unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM provider_membership_trials WHERE workspace_id=_workspace) THEN RETURN false; END IF;
 INSERT INTO provider_membership_trials(workspace_id,environment,started_at,ends_at,source_subscription_id) VALUES(_workspace,_env,_started,_started+interval '30 days',_subscription); RETURN true; END $$;
REVOKE ALL ON FUNCTION public.pass4m_reserve_workspace_trial(uuid,text,text,timestamptz) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.pass4m_reserve_workspace_trial(uuid,text,text,timestamptz) TO service_role;
CREATE FUNCTION public.pass4m_claim_sandbox_event(_id text,_type text,_source text,_evidence jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN
 IF _id IS NULL OR _id !~ '^evt_[a-zA-Z0-9_]+$' OR _source NOT IN ('platform','connect') OR _evidence->>'environment'<>'sandbox' OR _evidence->>'livemode'<>'false' OR NOT EXISTS(SELECT 1 FROM platform_launch_flags WHERE key='pass4m_sandbox_reconciliation' AND enabled) THEN RAISE EXCEPTION 'Reconciliation unavailable'; END IF;
 INSERT INTO network_stripe_events(event_id,event_type,environment,source,preparation_evidence) VALUES(_id,_type,'sandbox',_source,_evidence) ON CONFLICT(event_id) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1; END $$;
REVOKE ALL ON FUNCTION public.pass4m_claim_sandbox_event(text,text,text,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.pass4m_claim_sandbox_event(text,text,text,jsonb) TO service_role;
CREATE FUNCTION public.pass4m_finish_sandbox_event(_id text,_outcome text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF _outcome NOT IN ('pending_policy_review','rejected','unrelated','not_configured') OR length(coalesce(_reason,''))>100 THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
 UPDATE network_stripe_events SET preparation_evidence=preparation_evidence||jsonb_build_object('outcome',_outcome,'reason',_reason,'receivedAt',now()) WHERE event_id=_id AND environment='sandbox' AND preparation_evidence IS NOT NULL; END $$;
REVOKE ALL ON FUNCTION public.pass4m_finish_sandbox_event(text,text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.pass4m_finish_sandbox_event(text,text,text) TO service_role;
CREATE FUNCTION public.pass4m_list_reconciliation() RETURNS TABLE(event_id text,event_type text,environment text,source text,processed_at timestamptz,preparation_evidence jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT event_id,event_type,environment,source,processed_at,preparation_evidence FROM network_stripe_events WHERE public.has_role(auth.uid(),'admin') AND environment='sandbox' ORDER BY processed_at DESC LIMIT 200 $$;
REVOKE ALL ON FUNCTION public.pass4m_list_reconciliation() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.pass4m_list_reconciliation() TO authenticated;