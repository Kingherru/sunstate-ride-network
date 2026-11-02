-- Pass 3O-B: test-mode settlement payment attempts, fee policy, transfers, webhook dedupe, exclusions, dispute resolution.

CREATE OR REPLACE FUNCTION public.network_receiver_hold_tier(_workspace uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE lvl text := coalesce(public.provider_verification_evidence_internal(_workspace)->>'level','none');
BEGIN RETURN jsonb_build_object('tier', CASE WHEN lvl='gold' THEN 'super_verified' ELSE lvl END, 'hold_days', CASE WHEN lvl='gold' THEN 4 ELSE 10 END); END $$;
REVOKE ALL ON FUNCTION public.network_receiver_hold_tier(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_receiver_hold_tier(uuid) TO service_role;

ALTER TABLE public.network_settlements ADD COLUMN IF NOT EXISTS completion_confirmed_at timestamptz, ADD COLUMN IF NOT EXISTS transfer_status text, ADD COLUMN IF NOT EXISTS transfer_created_at timestamptz, ADD COLUMN IF NOT EXISTS transfer_reversed_at timestamptz, ADD COLUMN IF NOT EXISTS payout_status text, ADD COLUMN IF NOT EXISTS paid_out_at timestamptz, ADD COLUMN IF NOT EXISTS refunded_at timestamptz, ADD COLUMN IF NOT EXISTS chargeback_status text, ADD COLUMN IF NOT EXISTS fee_policy_version integer;

CREATE OR REPLACE FUNCTION public.network_settlement_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements; payout integer; fee integer; t jsonb; st text;
BEGIN
  IF NEW.selected_offer_id IS NULL OR NEW.selected_workspace_id IS NULL OR NEW.source_workspace_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.network_settlements WHERE distribution_id = NEW.id FOR UPDATE;
  IF s.id IS NULL THEN
    SELECT amount_cents INTO payout FROM public.provider_trip_offers WHERE id = NEW.selected_offer_id;
    payout := coalesce(payout, NEW.amount_cents); fee := round(payout * 0.02);
    INSERT INTO public.network_settlements(distribution_id, offer_id, trip_id, source_mfn_id, sender_workspace_id, sender_workspace_mfn_id, receiver_workspace_id, receiver_workspace_mfn_id, acting_sender_mfn_id, receiver_payout_cents, network_fee_cents, sender_total_due_cents)
    VALUES (NEW.id, NEW.selected_offer_id, NEW.trip_id, NEW.source_mfn_id, NEW.source_workspace_id, (SELECT mfn_id FROM public.workspaces WHERE id=NEW.source_workspace_id), NEW.selected_workspace_id, (SELECT mfn_id FROM public.workspaces WHERE id=NEW.selected_workspace_id), NEW.acting_person_mfn_id, payout, fee, payout + fee)
    RETURNING * INTO s;
    INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (s.id, 'settlement_created', jsonb_build_object('receiver_payout_cents', payout, 'network_fee_cents', fee));
  END IF;
  IF NEW.payment_completed_at IS NOT NULL AND s.payment_succeeded_at IS NULL THEN
    t := public.network_receiver_hold_tier(NEW.selected_workspace_id);
    UPDATE public.network_settlements SET payment_succeeded_at = NEW.payment_completed_at, verification_tier_snapshot = t->>'tier', hold_days = (t->>'hold_days')::int,
      hold_started_at = CASE WHEN NEW.dispute_opened_at IS NULL OR NEW.dispute_resolved_at IS NOT NULL THEN NEW.payment_completed_at END,
      release_eligible_at = CASE WHEN NEW.dispute_opened_at IS NULL OR NEW.dispute_resolved_at IS NOT NULL THEN NEW.payment_completed_at + make_interval(days => (t->>'hold_days')::int) END
    WHERE id = s.id RETURNING * INTO s;
    INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (s.id, 'hold_snapshot', t);
  END IF;
  IF NEW.dispute_resolved_at IS NOT NULL AND s.dispute_resolved_at IS DISTINCT FROM NEW.dispute_resolved_at AND s.hold_days IS NOT NULL THEN
    UPDATE public.network_settlements SET hold_started_at = NEW.dispute_resolved_at, release_eligible_at = NEW.dispute_resolved_at + make_interval(days => s.hold_days) WHERE id = s.id RETURNING * INTO s;
    INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (s.id, 'hold_restarted', jsonb_build_object('hold_days', s.hold_days));
  END IF;
  st := CASE
    WHEN NEW.network_payment_state = 'refunded' THEN 'refunded'
    WHEN NEW.network_payment_state = 'canceled' THEN 'canceled'
    WHEN NEW.dispute_opened_at IS NOT NULL AND NEW.dispute_resolved_at IS NULL THEN 'disputed'
    WHEN NEW.payment_completed_at IS NOT NULL THEN 'held'
    WHEN NEW.network_completed_at IS NOT NULL THEN 'under_review'
    ELSE 'pending_completion' END;
  UPDATE public.network_settlements SET completed_at = NEW.network_completed_at,
    review_window_ends_at = NEW.network_completed_at + interval '24 hours',
    payment_deadline_at = public.network_payment_due_at(NEW.network_completed_at + interval '24 hours'),
    dispute_opened_at = NEW.dispute_opened_at, dispute_resolved_at = NEW.dispute_resolved_at, state = st
  WHERE id = s.id AND (state, completed_at, dispute_opened_at, dispute_resolved_at) IS DISTINCT FROM (st, NEW.network_completed_at, NEW.dispute_opened_at, NEW.dispute_resolved_at);
  IF FOUND THEN INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (s.id, 'state_' || st, '{}'::jsonb); END IF;
  RETURN NEW;
END $$;

CREATE TABLE public.network_fee_policies (
  version integer NOT NULL,
  method_category text NOT NULL CHECK (method_category IN ('card','ach')),
  percent_bps integer NOT NULL CHECK (percent_bps BETWEEN 0 AND 1000),
  fixed_cents integer NOT NULL DEFAULT 0 CHECK (fixed_cents >= 0),
  cap_cents integer,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  sandbox_estimate boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (version, method_category, environment)
);
GRANT ALL ON public.network_fee_policies TO service_role;
ALTER TABLE public.network_fee_policies ENABLE ROW LEVEL SECURITY;
INSERT INTO public.network_fee_policies(version, method_category, percent_bps, fixed_cents, cap_cents, environment, sandbox_estimate, note) VALUES
 (1,'card',290,30,NULL,'sandbox',true,'Sandbox estimate of standard card/wallet processing; live rate not approved'),
 (1,'ach',80,0,500,'sandbox',true,'Sandbox estimate of ACH Direct Debit; live rate not approved');

CREATE OR REPLACE FUNCTION public.network_compute_quote(_settlement uuid, _method text, _env text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements; p public.network_fee_policies; base integer; adj integer; total integer; proc integer;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE id=_settlement;
  SELECT * INTO p FROM public.network_fee_policies WHERE method_category=_method AND environment=_env AND active ORDER BY version DESC LIMIT 1;
  IF s.id IS NULL OR p.version IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(sum(delta_receiver_cents),0) INTO adj FROM public.network_settlement_adjustments WHERE settlement_id=s.id;
  base := s.receiver_payout_cents + s.network_fee_cents;
  total := ceil((base + p.fixed_cents)::numeric / (1 - p.percent_bps::numeric/10000));
  proc := total - base;
  IF p.cap_cents IS NOT NULL AND proc > p.cap_cents THEN proc := p.cap_cents; total := base + proc; END IF;
  RETURN jsonb_build_object('receiver_payout_cents', s.receiver_payout_cents, 'network_fee_cents', s.network_fee_cents, 'processing_fee_cents', proc, 'total_cents', total, 'policy_version', p.version, 'method', _method, 'sandbox_estimate', p.sandbox_estimate, 'adjustment_cents', adj);
END $$;
REVOKE ALL ON FUNCTION public.network_compute_quote(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_compute_quote(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.network_payment_quote(_settlement uuid, _method text, _env text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE id=_settlement;
  IF s.id IS NULL OR NOT public.network_workspace_access(s.sender_workspace_id,true) THEN RAISE EXCEPTION 'Not available'; END IF;
  RETURN public.network_compute_quote(_settlement,_method,_env);
END $$;
REVOKE ALL ON FUNCTION public.network_payment_quote(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_payment_quote(uuid,text,text) TO authenticated;

CREATE SEQUENCE IF NOT EXISTS public.network_payment_attempt_seq;
CREATE TABLE public.network_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mfn_id text NOT NULL UNIQUE DEFAULT ('MFN-PA-' || lpad(nextval('public.network_payment_attempt_seq')::text, 6, '0')),
  settlement_id uuid NOT NULL REFERENCES public.network_settlements(id),
  settlement_mfn_id text NOT NULL,
  sender_workspace_id uuid NOT NULL,
  sender_workspace_mfn_id text,
  acting_user_mfn_id text,
  method_category text NOT NULL CHECK (method_category IN ('card','ach')),
  receiver_payout_cents integer NOT NULL,
  network_fee_cents integer NOT NULL,
  processing_fee_cents integer NOT NULL,
  total_cents integer NOT NULL,
  fee_policy_version integer NOT NULL,
  stripe_environment text NOT NULL CHECK (stripe_environment IN ('sandbox','live')),
  payment_intent_ref text UNIQUE,
  charge_ref text,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','processing','succeeded','failed','canceled','refunded')),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz, failed_at timestamptz, canceled_at timestamptz, refunded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX network_payment_attempts_one_success ON public.network_payment_attempts(settlement_id) WHERE status IN ('succeeded','refunded');
CREATE TABLE public.network_payment_attempt_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.network_payment_attempts(id),
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.network_payment_attempts, public.network_payment_attempt_events TO service_role;
ALTER TABLE public.network_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_payment_attempt_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER network_payment_attempt_events_ro BEFORE UPDATE OR DELETE ON public.network_payment_attempt_events FOR EACH ROW EXECUTE FUNCTION public.network_append_only();
CREATE OR REPLACE FUNCTION public.network_attempt_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment attempts cannot be deleted'; END IF;
  IF (NEW.total_cents, NEW.receiver_payout_cents, NEW.network_fee_cents, NEW.processing_fee_cents, NEW.fee_policy_version, NEW.settlement_id, NEW.idempotency_key, NEW.method_category)
     IS DISTINCT FROM (OLD.total_cents, OLD.receiver_payout_cents, OLD.network_fee_cents, OLD.processing_fee_cents, OLD.fee_policy_version, OLD.settlement_id, OLD.idempotency_key, OLD.method_category)
     OR (OLD.payment_intent_ref IS NOT NULL AND NEW.payment_intent_ref IS DISTINCT FROM OLD.payment_intent_ref) THEN
    RAISE EXCEPTION 'Locked payment attempt terms cannot change';
  END IF;
  NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER network_attempt_guard BEFORE UPDATE OR DELETE ON public.network_payment_attempts FOR EACH ROW EXECUTE FUNCTION public.network_attempt_guard();

CREATE OR REPLACE FUNCTION public.network_prepare_payment_attempt(_settlement uuid, _method text, _env text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements; d public.trip_distributions; q jsonb; a public.network_payment_attempts; key text;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE id=_settlement FOR UPDATE;
  IF s.id IS NULL OR NOT public.network_workspace_access(s.sender_workspace_id,true) THEN RAISE EXCEPTION 'Not available'; END IF;
  IF _env <> s.stripe_environment THEN RAISE EXCEPTION 'Not available'; END IF;
  IF s.state <> 'under_review' OR s.payment_succeeded_at IS NOT NULL OR (s.dispute_opened_at IS NOT NULL AND s.dispute_resolved_at IS NULL) THEN RAISE EXCEPTION 'This settlement is not payable'; END IF;
  IF now() < s.review_window_ends_at AND s.completion_confirmed_at IS NULL THEN RAISE EXCEPTION 'Payment opens after the 24-hour review window or after you confirm completion'; END IF;
  SELECT * INTO d FROM public.trip_distributions WHERE id=s.distribution_id;
  IF d.selected_offer_id IS NULL THEN RAISE EXCEPTION 'Accepted terms are required'; END IF;
  IF d.payment_responsibility_ack_at IS NULL THEN UPDATE public.trip_distributions SET payment_responsibility_ack_at=now(), payment_responsibility_ack_by=auth.uid() WHERE id=d.id; END IF;
  q := public.network_compute_quote(s.id,_method,_env);
  IF q IS NULL THEN RAISE EXCEPTION 'This payment method is not available'; END IF;
  SELECT * INTO a FROM public.network_payment_attempts WHERE settlement_id=s.id AND method_category=_method AND fee_policy_version=(q->>'policy_version')::int AND status IN ('created','processing','succeeded') ORDER BY created_at DESC LIMIT 1;
  key := 'nsp_' || s.payment_idempotency_key || '_' || _method || '_v' || (q->>'policy_version') || '_' || (SELECT count(*) FROM public.network_payment_attempts WHERE settlement_id=s.id);
  IF a.id IS NULL THEN
    INSERT INTO public.network_payment_attempts(settlement_id, settlement_mfn_id, sender_workspace_id, sender_workspace_mfn_id, acting_user_mfn_id, method_category, receiver_payout_cents, network_fee_cents, processing_fee_cents, total_cents, fee_policy_version, stripe_environment, idempotency_key)
    VALUES (s.id, s.mfn_id, s.sender_workspace_id, s.sender_workspace_mfn_id, (SELECT mfn_id FROM public.user_profiles WHERE user_id=auth.uid()), _method, (q->>'receiver_payout_cents')::int, (q->>'network_fee_cents')::int, (q->>'processing_fee_cents')::int, (q->>'total_cents')::int, (q->>'policy_version')::int, _env, key)
    RETURNING * INTO a;
    INSERT INTO public.network_payment_attempt_events(attempt_id, event_type, details) VALUES (a.id, 'attempt_created', jsonb_build_object('total_cents', a.total_cents, 'policy_version', a.fee_policy_version));
    INSERT INTO public.network_settlement_events(settlement_id, event_type, actor_mfn_id, details) VALUES (s.id, 'payment_attempt_created', a.acting_user_mfn_id, jsonb_build_object('attempt', a.mfn_id, 'method', _method));
  END IF;
  IF a.status = 'succeeded' THEN RAISE EXCEPTION 'This settlement is already paid'; END IF;
  RETURN jsonb_build_object('id', a.id, 'mfn_id', a.mfn_id, 'settlement_mfn_id', a.settlement_mfn_id, 'transfer_group', s.transfer_group, 'idempotency_key', a.idempotency_key, 'total_cents', a.total_cents, 'has_intent', a.payment_intent_ref IS NOT NULL, 'receiver_payout_cents', a.receiver_payout_cents, 'network_fee_cents', a.network_fee_cents, 'processing_fee_cents', a.processing_fee_cents, 'policy_version', a.fee_policy_version);
END $$;
REVOKE ALL ON FUNCTION public.network_prepare_payment_attempt(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_prepare_payment_attempt(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.network_confirm_completion(_settlement uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE id=_settlement FOR UPDATE;
  IF s.id IS NULL OR NOT public.network_workspace_access(s.sender_workspace_id,true) THEN RAISE EXCEPTION 'Not available'; END IF;
  IF s.state <> 'under_review' OR s.completion_confirmed_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.network_settlements SET completion_confirmed_at=now() WHERE id=s.id;
  INSERT INTO public.network_settlement_events(settlement_id, event_type, actor_mfn_id) VALUES (s.id, 'completion_confirmed', (SELECT mfn_id FROM public.user_profiles WHERE user_id=auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.network_confirm_completion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_confirm_completion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.network_record_attempt_result(_intent text, _env text, _status text, _amount_received integer, _charge text, _error text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.network_payment_attempts; s public.network_settlements;
BEGIN
  SELECT * INTO a FROM public.network_payment_attempts WHERE payment_intent_ref=_intent AND stripe_environment=_env FOR UPDATE;
  IF a.id IS NULL THEN RETURN; END IF;
  IF a.status IN ('succeeded','refunded') THEN RETURN; END IF;
  IF _status = 'succeeded' THEN
    IF _amount_received IS DISTINCT FROM a.total_cents THEN
      INSERT INTO public.network_payment_attempt_events(attempt_id, event_type, details) VALUES (a.id, 'amount_mismatch', jsonb_build_object('received', _amount_received));
      RETURN;
    END IF;
    SELECT * INTO s FROM public.network_settlements WHERE id=a.settlement_id FOR UPDATE;
    IF s.payment_succeeded_at IS NOT NULL THEN
      INSERT INTO public.network_payment_attempt_events(attempt_id, event_type) VALUES (a.id, 'duplicate_success_ignored');
      RETURN;
    END IF;
    UPDATE public.network_payment_attempts SET status='succeeded', confirmed_at=now(), charge_ref=_charge, error_code=NULL WHERE id=a.id;
    UPDATE public.network_settlements SET processing_fee_cents=a.processing_fee_cents, sender_total_due_cents=a.total_cents, fee_policy_version=a.fee_policy_version, payment_intent_ref=_intent, charge_ref=_charge WHERE id=s.id;
    UPDATE public.trip_distributions SET payment_completed_at=now(), payment_initiated_at=coalesce(payment_initiated_at, now()), network_payment_state='paid', updated_at=now() WHERE id=s.distribution_id AND payment_completed_at IS NULL;
    INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (s.id, 'payment_succeeded', jsonb_build_object('attempt', a.mfn_id, 'total_cents', a.total_cents));
  ELSIF _status IN ('failed','canceled') THEN
    UPDATE public.network_payment_attempts SET status=_status, error_code=left(_error,80), failed_at=CASE WHEN _status='failed' THEN now() END, canceled_at=CASE WHEN _status='canceled' THEN now() END WHERE id=a.id;
    INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (a.settlement_id, 'payment_' || _status, jsonb_build_object('attempt', a.mfn_id));
  ELSE
    UPDATE public.network_payment_attempts SET status='processing' WHERE id=a.id AND status='created';
  END IF;
  INSERT INTO public.network_payment_attempt_events(attempt_id, event_type, details) VALUES (a.id, 'stripe_' || _status, jsonb_build_object('error', left(_error,80)));
END $$;
REVOKE ALL ON FUNCTION public.network_record_attempt_result(text,text,text,integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_record_attempt_result(text,text,text,integer,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.network_record_charge_state(_charge text, _env text, _refunded boolean, _dispute text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE charge_ref=_charge AND stripe_environment=_env FOR UPDATE;
  IF s.id IS NULL THEN RETURN; END IF;
  IF _refunded AND s.refunded_at IS NULL THEN
    UPDATE public.network_settlements SET refunded_at=now() WHERE id=s.id;
    UPDATE public.network_payment_attempts SET status='refunded', refunded_at=now() WHERE settlement_id=s.id AND status='succeeded';
    UPDATE public.trip_distributions SET network_payment_state='refunded', updated_at=now() WHERE id=s.distribution_id;
    INSERT INTO public.network_settlement_events(settlement_id, event_type) VALUES (s.id, 'refunded');
  END IF;
  IF _dispute IS NOT NULL AND s.chargeback_status IS DISTINCT FROM _dispute THEN
    UPDATE public.network_settlements SET chargeback_status=_dispute WHERE id=s.id;
    IF _dispute IN ('warning_needs_response','needs_response','under_review','warning_under_review') THEN
      UPDATE public.trip_distributions SET dispute_opened_at=coalesce(dispute_opened_at, now()), dispute_resolved_at=NULL, dispute_reason_code=coalesce(dispute_reason_code,'chargeback'), updated_at=now() WHERE id=s.distribution_id;
    ELSIF _dispute='won' THEN
      UPDATE public.trip_distributions SET dispute_resolved_at=now(), updated_at=now() WHERE id=s.distribution_id AND dispute_resolved_at IS NULL;
    ELSIF _dispute='lost' THEN
      UPDATE public.trip_distributions SET network_payment_state='refunded', updated_at=now() WHERE id=s.distribution_id;
    END IF;
    INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (s.id, 'chargeback_' || _dispute, '{}'::jsonb);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.network_record_charge_state(text,text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_record_charge_state(text,text,boolean,text) TO service_role;

CREATE TABLE public.network_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL UNIQUE REFERENCES public.network_settlements(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  stripe_environment text NOT NULL,
  transfer_ref text UNIQUE,
  destination_ref text,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','created','failed','reversed')),
  error_code text,
  actor_mfn_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  transferred_at timestamptz, failed_at timestamptz, reversed_at timestamptz
);
GRANT ALL ON public.network_transfers TO service_role;
ALTER TABLE public.network_transfers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.network_claim_transfer(_settlement uuid, _env text, _actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements; acct record; adj integer; amt integer; tr public.network_transfers;
BEGIN
  IF NOT public.is_master_admin(_actor) THEN RAISE EXCEPTION 'Master Admin required'; END IF;
  IF _env <> 'sandbox' THEN RAISE EXCEPTION 'Test mode only'; END IF;
  SELECT * INTO s FROM public.network_settlements WHERE id=_settlement FOR UPDATE;
  IF s.id IS NULL OR s.stripe_environment <> 'sandbox' THEN RAISE EXCEPTION 'Not available'; END IF;
  IF s.state <> 'held' OR s.payment_succeeded_at IS NULL OR s.charge_ref IS NULL OR s.refunded_at IS NOT NULL THEN RAISE EXCEPTION 'Settlement is not paid and held'; END IF;
  IF s.release_eligible_at IS NULL OR now() < s.release_eligible_at THEN RAISE EXCEPTION 'The hold has not ended'; END IF;
  IF EXISTS(SELECT 1 FROM public.network_disputes WHERE settlement_id=s.id AND status='open') OR (s.dispute_opened_at IS NOT NULL AND s.dispute_resolved_at IS NULL) THEN RAISE EXCEPTION 'An open dispute pauses release'; END IF;
  SELECT stripe_account_id, payouts_enabled INTO acct FROM public.provider_payout_accounts WHERE workspace_id=s.receiver_workspace_id AND environment='sandbox' AND stripe_account_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1;
  IF acct.stripe_account_id IS NULL OR NOT acct.payouts_enabled THEN RAISE EXCEPTION 'Receiver Connect account is not ready'; END IF;
  SELECT coalesce(sum(delta_receiver_cents),0) INTO adj FROM public.network_settlement_adjustments WHERE settlement_id=s.id;
  amt := least(s.receiver_payout_cents, s.receiver_payout_cents + adj);
  IF amt <= 0 THEN RAISE EXCEPTION 'Nothing to transfer'; END IF;
  SELECT * INTO tr FROM public.network_transfers WHERE settlement_id=s.id;
  IF tr.id IS NOT NULL AND tr.status IN ('created','reversed') THEN RAISE EXCEPTION 'Already transferred'; END IF;
  IF tr.id IS NULL THEN
    INSERT INTO public.network_transfers(settlement_id, amount_cents, stripe_environment, destination_ref, idempotency_key, actor_mfn_id)
    VALUES (s.id, amt, 'sandbox', acct.stripe_account_id, 'nst_' || s.transfer_idempotency_key, (SELECT mfn_id FROM public.user_profiles WHERE user_id=_actor)) RETURNING * INTO tr;
  END IF;
  RETURN jsonb_build_object('transfer_id', tr.id, 'amount_cents', tr.amount_cents, 'destination', tr.destination_ref, 'idempotency_key', tr.idempotency_key, 'transfer_group', s.transfer_group, 'charge_ref', s.charge_ref, 'settlement_mfn_id', s.mfn_id);
END $$;
REVOKE ALL ON FUNCTION public.network_claim_transfer(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_claim_transfer(uuid,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.network_record_transfer(_transfer_ref text, _settlement_mfn text, _status text, _error text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements; tr public.network_transfers;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE mfn_id=_settlement_mfn FOR UPDATE;
  IF s.id IS NULL THEN RETURN; END IF;
  SELECT * INTO tr FROM public.network_transfers WHERE settlement_id=s.id FOR UPDATE;
  IF tr.id IS NULL THEN RETURN; END IF;
  IF _status='created' AND tr.status IN ('creating','failed') THEN
    UPDATE public.network_transfers SET status='created', transfer_ref=coalesce(transfer_ref,_transfer_ref), transferred_at=now(), error_code=NULL WHERE id=tr.id;
    UPDATE public.network_settlements SET transfer_ref=_transfer_ref, transfer_status='created', transfer_created_at=now(), payout_status='pending' WHERE id=s.id;
    INSERT INTO public.network_settlement_events(settlement_id, event_type) VALUES (s.id, 'transfer_created');
  ELSIF _status='failed' AND tr.status='creating' THEN
    UPDATE public.network_transfers SET status='failed', failed_at=now(), error_code=left(_error,80) WHERE id=tr.id;
    INSERT INTO public.network_settlement_events(settlement_id, event_type) VALUES (s.id, 'transfer_failed');
  ELSIF _status='reversed' AND tr.status='created' THEN
    UPDATE public.network_transfers SET status='reversed', reversed_at=now() WHERE id=tr.id;
    UPDATE public.network_settlements SET transfer_status='reversed', transfer_reversed_at=now() WHERE id=s.id;
    INSERT INTO public.network_settlement_events(settlement_id, event_type) VALUES (s.id, 'transfer_reversed');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.network_record_transfer(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_record_transfer(text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.network_record_payout(_account text, _payout text, _status text, _payout_created timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ws uuid;
BEGIN
  SELECT workspace_id INTO ws FROM public.provider_payout_accounts WHERE stripe_account_id=_account LIMIT 1;
  IF ws IS NULL THEN RETURN; END IF;
  IF _status='paid' THEN
    WITH u AS (UPDATE public.network_settlements SET payout_ref=_payout, payout_status='paid', paid_out_at=now()
      WHERE receiver_workspace_id=ws AND transfer_status='created' AND payout_ref IS NULL AND transfer_created_at <= _payout_created RETURNING id)
    INSERT INTO public.network_settlement_events(settlement_id, event_type) SELECT id, 'payout_paid' FROM u;
  ELSIF _status='failed' THEN
    WITH u AS (UPDATE public.network_settlements SET payout_status='failed' WHERE receiver_workspace_id=ws AND transfer_status='created' AND payout_ref IS NULL AND coalesce(payout_status,'') <> 'failed' RETURNING id)
    INSERT INTO public.network_settlement_events(settlement_id, event_type) SELECT id, 'payout_failed' FROM u;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.network_record_payout(text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_record_payout(text,text,text,timestamptz) TO service_role;

CREATE TABLE public.network_stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  environment text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.network_stripe_events TO service_role;
ALTER TABLE public.network_stripe_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.network_distribution_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL,
  provider_workspace_id uuid NOT NULL,
  provider_workspace_mfn_id text,
  reason_code text NOT NULL CHECK (reason_code IN ('inactive','suspended','network_entitlement_missing','capability_mismatch','service_area_mismatch','connect_not_ready','already_offered','declined','expired','source_workspace','test_account','other')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.network_distribution_exclusions TO service_role;
ALTER TABLE public.network_distribution_exclusions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER network_distribution_exclusions_ro BEFORE UPDATE OR DELETE ON public.network_distribution_exclusions FOR EACH ROW EXECUTE FUNCTION public.network_append_only();

CREATE OR REPLACE FUNCTION public.network_admin_exclusion_reasons(_distribution uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.trip_distributions;
BEGIN
  IF NOT public.is_master_admin(auth.uid()) THEN RAISE EXCEPTION 'Master Admin required'; END IF;
  SELECT * INTO d FROM public.trip_distributions WHERE id=_distribution;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Not available'; END IF;
  INSERT INTO public.network_distribution_exclusions(distribution_id, provider_workspace_id, provider_workspace_mfn_id, reason_code)
  SELECT d.id, w.id, w.mfn_id, r.code FROM public.workspaces w
  LEFT JOIN public.provider_network_profiles p ON p.workspace_id=w.id
  LEFT JOIN LATERAL (SELECT o.status FROM public.provider_trip_offers o WHERE o.distribution_id=d.id AND o.provider_workspace_id=w.id ORDER BY o.created_at DESC LIMIT 1) o ON true
  CROSS JOIN LATERAL (SELECT CASE
     WHEN w.id = d.source_workspace_id THEN 'source_workspace'
     WHEN w.is_test_account THEN 'test_account'
     WHEN w.status::text = 'suspended' THEN 'suspended'
     WHEN w.status::text <> 'active' THEN 'inactive'
     WHEN o.status = 'declined' THEN 'declined'
     WHEN o.status = 'expired' THEN 'expired'
     WHEN o.status IS NOT NULL THEN 'already_offered'
     WHEN NOT public.provider_network_entitled(w.id) THEN 'network_entitlement_missing'
     WHEN p.workspace_id IS NULL OR NOT (d.capability = ANY(coalesce(p.approved_service_types, p.service_types, '{}'))) THEN 'capability_mismatch'
     WHEN p.service_base_verified_at IS NULL THEN 'service_area_mismatch'
     WHEN NOT EXISTS(SELECT 1 FROM public.provider_payout_accounts pa WHERE pa.workspace_id=w.id AND pa.payouts_enabled) THEN 'connect_not_ready'
     ELSE NULL END AS code) r
  WHERE w.account_type='provider' AND r.code IS NOT NULL;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('provider_mfn_id', x.provider_workspace_mfn_id, 'reason_code', x.reason_code, 'recorded_at', x.created_at) ORDER BY x.reason_code, x.provider_workspace_mfn_id), '[]'::jsonb)
    FROM (SELECT DISTINCT ON (provider_workspace_id) * FROM public.network_distribution_exclusions WHERE distribution_id=d.id ORDER BY provider_workspace_id, created_at DESC) x);
END $$;
REVOKE ALL ON FUNCTION public.network_admin_exclusion_reasons(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_admin_exclusion_reasons(uuid) TO authenticated;

ALTER TABLE public.network_disputes ADD COLUMN IF NOT EXISTS resolution text CHECK (resolution IS NULL OR resolution IN ('sender','receiver','partial')), ADD COLUMN IF NOT EXISTS resolution_reason text, ADD COLUMN IF NOT EXISTS resolved_at timestamptz, ADD COLUMN IF NOT EXISTS resolved_by_mfn_id text;
CREATE UNIQUE INDEX IF NOT EXISTS network_disputes_one_open ON public.network_disputes(settlement_id) WHERE status='open';

CREATE OR REPLACE FUNCTION public.network_admin_resolve_dispute(_dispute uuid, _outcome text, _reason text, _adjust_cents integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x public.network_disputes; s public.network_settlements; actor text; ver integer;
BEGIN
  IF NOT public.is_master_admin(auth.uid()) THEN RAISE EXCEPTION 'Master Admin required'; END IF;
  IF _outcome NOT IN ('sender','receiver','partial') OR length(coalesce(trim(_reason),'')) < 10 THEN RAISE EXCEPTION 'Outcome and a reason (10+ characters) are required'; END IF;
  SELECT * INTO x FROM public.network_disputes WHERE id=_dispute FOR UPDATE;
  IF x.id IS NULL OR x.status <> 'open' THEN RAISE EXCEPTION 'Dispute is not open'; END IF;
  SELECT * INTO s FROM public.network_settlements WHERE id=x.settlement_id FOR UPDATE;
  IF s.stripe_environment <> 'sandbox' THEN RAISE EXCEPTION 'Test mode only'; END IF;
  actor := (SELECT mfn_id FROM public.user_profiles WHERE user_id=auth.uid());
  IF _outcome='partial' THEN
    IF _adjust_cents IS NULL OR _adjust_cents <= 0 OR _adjust_cents >= s.receiver_payout_cents THEN RAISE EXCEPTION 'Partial adjustment must be between $0.01 and the payout'; END IF;
    SELECT coalesce(max(version),0)+1 INTO ver FROM public.network_settlement_adjustments WHERE settlement_id=s.id;
    INSERT INTO public.network_settlement_adjustments(settlement_id, version, delta_receiver_cents, reason, actor_mfn_id) VALUES (s.id, ver, -_adjust_cents, trim(_reason), actor);
  END IF;
  UPDATE public.network_disputes SET status='resolved', resolution=_outcome, resolution_reason=left(trim(_reason),1000), resolved_at=now(), resolved_by_mfn_id=actor WHERE id=x.id;
  IF _outcome='sender' THEN
    UPDATE public.trip_distributions SET dispute_resolved_at=now(), network_payment_state=CASE WHEN payment_completed_at IS NULL THEN 'canceled' ELSE network_payment_state END, updated_at=now() WHERE id=s.distribution_id;
  ELSE
    UPDATE public.trip_distributions SET dispute_resolved_at=now(), updated_at=now() WHERE id=s.distribution_id;
  END IF;
  INSERT INTO public.network_settlement_events(settlement_id, event_type, actor_mfn_id, details) VALUES (s.id, 'dispute_resolved_' || _outcome, actor, jsonb_build_object('adjust_cents', _adjust_cents));
  RETURN jsonb_build_object('settlement_id', s.id, 'paid', s.payment_succeeded_at IS NOT NULL, 'transferred', s.transfer_status='created');
END $$;
REVOKE ALL ON FUNCTION public.network_admin_resolve_dispute(uuid,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_admin_resolve_dispute(uuid,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.network_admin_settlement_detail(_settlement uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE id=_settlement;
  IF s.id IS NULL OR NOT (public.is_master_admin(auth.uid()) OR (public.admin_can('network','read') AND (public.admin_can_account(s.sender_workspace_id) OR public.admin_can_account(s.receiver_workspace_id)))) THEN RAISE EXCEPTION 'Not available'; END IF;
  RETURN jsonb_build_object(
    'attempts', (SELECT coalesce(jsonb_agg(jsonb_build_object('mfn_id',a.mfn_id,'method',a.method_category,'total_cents',a.total_cents,'processing_fee_cents',a.processing_fee_cents,'policy_version',a.fee_policy_version,'status',a.status,'error_code',a.error_code,'actor',a.acting_user_mfn_id,'created_at',a.created_at,'confirmed_at',a.confirmed_at) ORDER BY a.created_at DESC),'[]'::jsonb) FROM public.network_payment_attempts a WHERE a.settlement_id=s.id),
    'transfer', (SELECT jsonb_build_object('amount_cents',t.amount_cents,'status',t.status,'transferred_at',t.transferred_at,'reversed_at',t.reversed_at,'error_code',t.error_code) FROM public.network_transfers t WHERE t.settlement_id=s.id),
    'disputes', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'category',d.category,'explanation',d.explanation,'evidence_count',jsonb_array_length(d.evidence_meta),'status',d.status,'resolution',d.resolution,'resolution_reason',d.resolution_reason,'resolved_at',d.resolved_at,'resolved_by',d.resolved_by_mfn_id,'opened_by',d.opened_by_mfn_id,'created_at',d.created_at) ORDER BY d.created_at DESC),'[]'::jsonb) FROM public.network_disputes d WHERE d.settlement_id=s.id),
    'adjustments', (SELECT coalesce(jsonb_agg(jsonb_build_object('version',j.version,'delta_receiver_cents',j.delta_receiver_cents,'reason',j.reason,'actor',j.actor_mfn_id,'created_at',j.created_at) ORDER BY j.version),'[]'::jsonb) FROM public.network_settlement_adjustments j WHERE j.settlement_id=s.id),
    'receiver_connect_ready', EXISTS(SELECT 1 FROM public.provider_payout_accounts pa WHERE pa.workspace_id=s.receiver_workspace_id AND pa.payouts_enabled AND pa.environment=s.stripe_environment),
    'chargeback_status', s.chargeback_status, 'refunded_at', s.refunded_at, 'payout_status', s.payout_status, 'transfer_status', s.transfer_status,
    'distribution_id', CASE WHEN public.is_master_admin(auth.uid()) THEN s.distribution_id END,
    'is_master', public.is_master_admin(auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.network_admin_settlement_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_admin_settlement_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.network_list_settlements() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'mfn_id', s.mfn_id, 'source_mfn_id', s.source_mfn_id,
    'side', CASE WHEN public.network_workspace_access(s.receiver_workspace_id,false) THEN 'receiver' WHEN public.network_workspace_access(s.sender_workspace_id,false) THEN 'sender' ELSE 'admin' END,
    'sender_workspace_mfn_id', s.sender_workspace_mfn_id, 'receiver_workspace_mfn_id', s.receiver_workspace_mfn_id,
    'receiver_payout_cents', s.receiver_payout_cents, 'network_fee_cents', s.network_fee_cents, 'processing_fee_cents', s.processing_fee_cents,
    'processing_fee_rule', s.processing_fee_rule, 'sender_total_due_cents', s.sender_total_due_cents, 'currency', s.currency,
    'completed_at', s.completed_at, 'review_window_ends_at', s.review_window_ends_at, 'payment_deadline_at', s.payment_deadline_at,
    'payment_succeeded_at', s.payment_succeeded_at, 'verification_tier_snapshot', s.verification_tier_snapshot, 'hold_days', s.hold_days,
    'release_eligible_at', s.release_eligible_at, 'dispute_opened_at', s.dispute_opened_at, 'dispute_resolved_at', s.dispute_resolved_at,
    'transferred', s.transfer_status = 'created', 'paid_out', s.payout_status = 'paid', 'payout_status', s.payout_status, 'transfer_status', s.transfer_status,
    'completion_confirmed_at', s.completion_confirmed_at, 'refunded_at', s.refunded_at, 'stripe_environment', s.stripe_environment,
    'attempt_status', (SELECT a.status FROM public.network_payment_attempts a WHERE a.settlement_id=s.id ORDER BY a.created_at DESC LIMIT 1),
    'state', s.state, 'created_at', s.created_at,
    'events', (SELECT coalesce(jsonb_agg(jsonb_build_object('event_type', e.event_type, 'actor_mfn_id', e.actor_mfn_id, 'created_at', e.created_at) ORDER BY e.created_at), '[]'::jsonb) FROM public.network_settlement_events e WHERE e.settlement_id = s.id)
  ) ORDER BY s.created_at DESC), '[]'::jsonb)
  FROM public.network_settlements s
  WHERE public.network_workspace_access(s.receiver_workspace_id,false) OR public.network_workspace_access(s.sender_workspace_id,false)
     OR (public.admin_can('network','read') AND (public.admin_can_account(s.sender_workspace_id) OR public.admin_can_account(s.receiver_workspace_id)));
$$;

INSERT INTO public.platform_launch_flags(key, enabled) VALUES ('network_live_settlement_collection', false), ('network_automatic_hold_release', false) ON CONFLICT (key) DO NOTHING;
