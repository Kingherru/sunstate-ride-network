ALTER TABLE public.network_payment_attempts
  ADD COLUMN IF NOT EXISTS subtotal_cents integer,
  ADD COLUMN IF NOT EXISTS fee_percent_bps integer,
  ADD COLUMN IF NOT EXISTS fee_fixed_cents integer,
  ADD COLUMN IF NOT EXISTS fee_cap_cents integer,
  ADD COLUMN IF NOT EXISTS fee_sandbox_estimate boolean,
  ADD COLUMN IF NOT EXISTS reported_processor_fee_cents integer,
  ADD COLUMN IF NOT EXISTS processor_fee_variance_cents integer;

ALTER TABLE public.network_stripe_events ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'platform';

CREATE OR REPLACE FUNCTION public.network_attempt_terms_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.fee_percent_bps IS NOT NULL AND (NEW.subtotal_cents, NEW.fee_percent_bps, NEW.fee_fixed_cents, NEW.fee_cap_cents, NEW.fee_sandbox_estimate)
     IS DISTINCT FROM (OLD.subtotal_cents, OLD.fee_percent_bps, OLD.fee_fixed_cents, OLD.fee_cap_cents, OLD.fee_sandbox_estimate) THEN
    RAISE EXCEPTION 'Locked fee policy terms cannot change';
  END IF;
  IF OLD.reported_processor_fee_cents IS NOT NULL AND NEW.reported_processor_fee_cents IS DISTINCT FROM OLD.reported_processor_fee_cents THEN
    RAISE EXCEPTION 'Reported processor fee is already recorded';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER network_attempt_terms_guard BEFORE UPDATE ON public.network_payment_attempts FOR EACH ROW EXECUTE FUNCTION public.network_attempt_terms_guard();

-- Gross-up recovery: total = ceil((subtotal + fixed) / (1 - rate)); capped methods never exceed the cap.
CREATE OR REPLACE FUNCTION public.network_compute_quote(_settlement uuid, _method text, _env text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements; p public.network_fee_policies; base integer; adj integer; total integer; proc integer;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE id=_settlement;
  SELECT * INTO p FROM public.network_fee_policies WHERE method_category=_method AND environment=_env AND active ORDER BY version DESC LIMIT 1;
  IF s.id IS NULL OR p.version IS NULL OR p.percent_bps >= 10000 THEN RETURN NULL; END IF;
  SELECT coalesce(sum(delta_receiver_cents),0) INTO adj FROM public.network_settlement_adjustments WHERE settlement_id=s.id;
  base := s.receiver_payout_cents + s.network_fee_cents;
  total := ceil((base + p.fixed_cents)::numeric / (1 - p.percent_bps::numeric/10000))::integer;
  proc := total - base;
  IF p.cap_cents IS NOT NULL AND proc > p.cap_cents THEN proc := p.cap_cents; total := base + proc; END IF;
  IF proc < 0 THEN proc := 0; total := base; END IF;
  RETURN jsonb_build_object('receiver_payout_cents', s.receiver_payout_cents, 'network_fee_cents', s.network_fee_cents, 'subtotal_cents', base,
    'processing_fee_cents', proc, 'total_cents', total, 'policy_version', p.version, 'method', _method, 'sandbox_estimate', p.sandbox_estimate,
    'percent_bps', p.percent_bps, 'fixed_cents', p.fixed_cents, 'cap_cents', p.cap_cents, 'adjustment_cents', adj);
END $$;
REVOKE ALL ON FUNCTION public.network_compute_quote(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_compute_quote(uuid,text,text) TO service_role;

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
  SELECT * INTO a FROM public.network_payment_attempts WHERE settlement_id=s.id AND method_category=_method AND status IN ('created','processing','succeeded') ORDER BY created_at DESC LIMIT 1;
  IF a.status = 'succeeded' THEN RAISE EXCEPTION 'This settlement is already paid'; END IF;
  -- Stale attempt: terms no longer match the current server quote.
  IF a.id IS NOT NULL AND (a.total_cents <> (q->>'total_cents')::int OR a.fee_policy_version <> (q->>'policy_version')::int OR a.fee_percent_bps IS NULL) THEN
    IF a.payment_intent_ref IS NOT NULL OR a.status = 'processing' THEN RAISE EXCEPTION 'This payment needs review before it can continue; nothing was charged'; END IF;
    UPDATE public.network_payment_attempts SET status='canceled', canceled_at=now(), error_code='stale_terms' WHERE id=a.id;
    INSERT INTO public.network_payment_attempt_events(attempt_id, event_type, details) VALUES (a.id, 'attempt_stale_canceled', '{}'::jsonb);
    a := NULL;
  END IF;
  IF a.id IS NULL THEN
    key := 'nsp_' || s.payment_idempotency_key || '_' || _method || '_v' || (q->>'policy_version') || '_' || (SELECT count(*) FROM public.network_payment_attempts WHERE settlement_id=s.id);
    INSERT INTO public.network_payment_attempts(settlement_id, settlement_mfn_id, sender_workspace_id, sender_workspace_mfn_id, acting_user_mfn_id, method_category, receiver_payout_cents, network_fee_cents, processing_fee_cents, total_cents, fee_policy_version, stripe_environment, idempotency_key, subtotal_cents, fee_percent_bps, fee_fixed_cents, fee_cap_cents, fee_sandbox_estimate)
    VALUES (s.id, s.mfn_id, s.sender_workspace_id, s.sender_workspace_mfn_id, (SELECT mfn_id FROM public.user_profiles WHERE user_id=auth.uid()), _method, (q->>'receiver_payout_cents')::int, (q->>'network_fee_cents')::int, (q->>'processing_fee_cents')::int, (q->>'total_cents')::int, (q->>'policy_version')::int, _env, key,
      (q->>'subtotal_cents')::int, (q->>'percent_bps')::int, (q->>'fixed_cents')::int, (q->>'cap_cents')::int, (q->>'sandbox_estimate')::boolean)
    RETURNING * INTO a;
    INSERT INTO public.network_payment_attempt_events(attempt_id, event_type, details) VALUES (a.id, 'attempt_created', jsonb_build_object('total_cents', a.total_cents, 'policy_version', a.fee_policy_version));
    INSERT INTO public.network_settlement_events(settlement_id, event_type, actor_mfn_id, details) VALUES (s.id, 'payment_attempt_created', a.acting_user_mfn_id, jsonb_build_object('attempt', a.mfn_id, 'method', _method));
  END IF;
  RETURN jsonb_build_object('id', a.id, 'mfn_id', a.mfn_id, 'settlement_mfn_id', a.settlement_mfn_id, 'transfer_group', s.transfer_group, 'idempotency_key', a.idempotency_key, 'total_cents', a.total_cents, 'has_intent', a.payment_intent_ref IS NOT NULL, 'receiver_payout_cents', a.receiver_payout_cents, 'network_fee_cents', a.network_fee_cents, 'processing_fee_cents', a.processing_fee_cents, 'policy_version', a.fee_policy_version, 'subtotal_cents', a.subtotal_cents, 'sandbox_estimate', a.fee_sandbox_estimate);
END $$;
REVOKE ALL ON FUNCTION public.network_prepare_payment_attempt(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_prepare_payment_attempt(uuid,text,text) TO authenticated;

-- Variance is recorded for reconciliation only; the sender is never charged again.
CREATE OR REPLACE FUNCTION public.network_record_processor_fee(_intent text, _env text, _fee integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.network_payment_attempts;
BEGIN
  SELECT * INTO a FROM public.network_payment_attempts WHERE payment_intent_ref=_intent AND stripe_environment=_env FOR UPDATE;
  IF a.id IS NULL OR a.reported_processor_fee_cents IS NOT NULL OR _fee IS NULL OR _fee < 0 THEN RETURN; END IF;
  UPDATE public.network_payment_attempts SET reported_processor_fee_cents=_fee, processor_fee_variance_cents=a.processing_fee_cents - _fee WHERE id=a.id;
  INSERT INTO public.network_payment_attempt_events(attempt_id, event_type, details) VALUES (a.id, 'processor_fee_reported', jsonb_build_object('reported_cents', _fee, 'variance_cents', a.processing_fee_cents - _fee));
END $$;
REVOKE ALL ON FUNCTION public.network_record_processor_fee(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.network_record_processor_fee(text,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.network_admin_attempt_fees(_settlement uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE id=_settlement;
  IF s.id IS NULL OR NOT (public.is_master_admin(auth.uid()) OR (public.admin_can('network','read') AND (public.admin_can_account(s.sender_workspace_id) OR public.admin_can_account(s.receiver_workspace_id)))) THEN RAISE EXCEPTION 'Not available'; END IF;
  RETURN jsonb_build_object(
    'attempts', (SELECT coalesce(jsonb_agg(jsonb_build_object('mfn_id',a.mfn_id,'method',a.method_category,'policy_version',a.fee_policy_version,'sandbox_estimate',a.fee_sandbox_estimate,
       'subtotal_cents',coalesce(a.subtotal_cents,a.receiver_payout_cents+a.network_fee_cents),'receiver_payout_cents',a.receiver_payout_cents,'network_fee_cents',a.network_fee_cents,
       'processing_fee_cents',a.processing_fee_cents,'total_cents',a.total_cents,'percent_bps',a.fee_percent_bps,'fixed_cents',a.fee_fixed_cents,'cap_cents',a.fee_cap_cents,
       'reported_processor_fee_cents',a.reported_processor_fee_cents,'variance_cents',a.processor_fee_variance_cents,'status',a.status) ORDER BY a.created_at DESC),'[]'::jsonb)
       FROM public.network_payment_attempts a WHERE a.settlement_id=s.id),
    'platform_webhook_last', (SELECT max(processed_at) FROM public.network_stripe_events WHERE source='platform' AND environment=s.stripe_environment),
    'connect_webhook_last', (SELECT max(processed_at) FROM public.network_stripe_events WHERE source='connect' AND environment=s.stripe_environment));
END $$;
REVOKE ALL ON FUNCTION public.network_admin_attempt_fees(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_admin_attempt_fees(uuid) TO authenticated;