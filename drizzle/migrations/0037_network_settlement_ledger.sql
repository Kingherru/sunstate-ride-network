ALTER TABLE public.trip_distributions ADD COLUMN IF NOT EXISTS payment_responsibility_ack_at timestamptz, ADD COLUMN IF NOT EXISTS payment_responsibility_ack_by uuid;

CREATE SEQUENCE IF NOT EXISTS public.network_settlement_seq;

CREATE TABLE public.network_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mfn_id text NOT NULL UNIQUE DEFAULT ('MFN-S-' || lpad(nextval('public.network_settlement_seq')::text, 6, '0')),
  distribution_id uuid NOT NULL UNIQUE,
  offer_id uuid,
  trip_id uuid,
  source_mfn_id text,
  sender_workspace_id uuid NOT NULL,
  sender_workspace_mfn_id text,
  receiver_workspace_id uuid NOT NULL,
  receiver_workspace_mfn_id text,
  acting_sender_mfn_id text,
  gross_amount_cents integer,
  receiver_payout_cents integer NOT NULL CHECK (receiver_payout_cents >= 0),
  sender_retained_cents integer,
  network_fee_cents integer NOT NULL CHECK (network_fee_cents >= 0),
  network_fee_bps integer NOT NULL DEFAULT 200,
  processing_fee_cents integer,
  processing_fee_rule text NOT NULL DEFAULT 'disclosed_before_payment',
  sender_total_due_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  completed_at timestamptz,
  review_window_ends_at timestamptz,
  payment_deadline_at timestamptz,
  payment_succeeded_at timestamptz,
  verification_tier_snapshot text,
  hold_days integer,
  hold_started_at timestamptz,
  release_eligible_at timestamptz,
  dispute_opened_at timestamptz,
  dispute_resolved_at timestamptz,
  stripe_environment text NOT NULL DEFAULT 'sandbox' CHECK (stripe_environment IN ('sandbox','live')),
  payment_intent_ref text, charge_ref text, transfer_ref text, payout_ref text, refund_ref text, dispute_ref text,
  transfer_group text GENERATED ALWAYS AS ('settlement_' || mfn_id) STORED,
  payment_idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text,
  transfer_idempotency_key text NOT NULL DEFAULT gen_random_uuid()::text,
  state text NOT NULL DEFAULT 'pending_completion',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.network_settlement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.network_settlements(id),
  event_type text NOT NULL,
  actor_mfn_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.network_settlement_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.network_settlements(id),
  version integer NOT NULL,
  delta_receiver_cents integer NOT NULL,
  reason text NOT NULL CHECK (length(reason) >= 10),
  actor_mfn_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_id, version)
);
CREATE TABLE public.network_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.network_settlements(id),
  category text NOT NULL,
  explanation text CHECK (explanation IS NULL OR length(explanation) <= 1000),
  evidence_meta jsonb NOT NULL DEFAULT '[]'::jsonb,
  opened_by_mfn_id text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.network_settlements, public.network_settlement_events, public.network_settlement_adjustments, public.network_disputes TO service_role;
ALTER TABLE public.network_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_settlement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_settlement_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_disputes ENABLE ROW LEVEL SECURITY;
-- No client policies: reads go through network_list_settlements().

CREATE OR REPLACE FUNCTION public.network_settlement_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Settlements cannot be deleted'; END IF;
  IF NEW.receiver_payout_cents IS DISTINCT FROM OLD.receiver_payout_cents OR NEW.network_fee_cents IS DISTINCT FROM OLD.network_fee_cents
     OR NEW.sender_workspace_id IS DISTINCT FROM OLD.sender_workspace_id OR NEW.receiver_workspace_id IS DISTINCT FROM OLD.receiver_workspace_id
     OR NEW.distribution_id IS DISTINCT FROM OLD.distribution_id OR NEW.mfn_id IS DISTINCT FROM OLD.mfn_id
     OR (OLD.hold_days IS NOT NULL AND NEW.hold_days IS DISTINCT FROM OLD.hold_days AND NEW.dispute_resolved_at IS NOT DISTINCT FROM OLD.dispute_resolved_at)
     OR (OLD.verification_tier_snapshot IS NOT NULL AND NEW.verification_tier_snapshot IS DISTINCT FROM OLD.verification_tier_snapshot) THEN
    RAISE EXCEPTION 'Accepted settlement terms are immutable; use a versioned adjustment';
  END IF;
  NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER network_settlement_guard BEFORE UPDATE OR DELETE ON public.network_settlements FOR EACH ROW EXECUTE FUNCTION public.network_settlement_guard();
CREATE OR REPLACE FUNCTION public.network_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'History is append-only'; END $$;
CREATE TRIGGER network_settlement_events_ro BEFORE UPDATE OR DELETE ON public.network_settlement_events FOR EACH ROW EXECUTE FUNCTION public.network_append_only();
CREATE TRIGGER network_settlement_adj_ro BEFORE UPDATE OR DELETE ON public.network_settlement_adjustments FOR EACH ROW EXECUTE FUNCTION public.network_append_only();

-- Sync ledger from the existing distribution lifecycle; server-computed amounts only.
CREATE OR REPLACE FUNCTION public.network_settlement_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements; payout integer; fee integer; tier text; hold integer; st text; ts timestamptz := now();
BEGIN
  IF NEW.selected_offer_id IS NULL OR NEW.selected_workspace_id IS NULL OR NEW.source_workspace_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.network_settlements WHERE distribution_id = NEW.id FOR UPDATE;
  IF s.id IS NULL THEN
    SELECT amount_cents INTO payout FROM public.provider_trip_offers WHERE id = NEW.selected_offer_id;
    payout := coalesce(payout, NEW.amount_cents);
    fee := round(payout * 0.02);
    INSERT INTO public.network_settlements(distribution_id, offer_id, trip_id, source_mfn_id, sender_workspace_id, sender_workspace_mfn_id, receiver_workspace_id, receiver_workspace_mfn_id, acting_sender_mfn_id, receiver_payout_cents, network_fee_cents, sender_total_due_cents)
    VALUES (NEW.id, NEW.selected_offer_id, NEW.trip_id, NEW.source_mfn_id, NEW.source_workspace_id, (SELECT mfn_id FROM public.workspaces WHERE id=NEW.source_workspace_id), NEW.selected_workspace_id, (SELECT mfn_id FROM public.workspaces WHERE id=NEW.selected_workspace_id), NEW.acting_person_mfn_id, payout, fee, payout + fee)
    RETURNING * INTO s;
    INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (s.id, 'settlement_created', jsonb_build_object('receiver_payout_cents', payout, 'network_fee_cents', fee));
  END IF;
  -- Snapshot tier + hold when sender payment first succeeds.
  IF NEW.payment_completed_at IS NOT NULL AND s.payment_succeeded_at IS NULL THEN
    tier := public.provider_verification_evidence_internal(NEW.selected_workspace_id)->>'level';
    hold := CASE WHEN tier IN ('super','super_verified') THEN 4 ELSE 10 END;
    UPDATE public.network_settlements SET payment_succeeded_at = NEW.payment_completed_at, verification_tier_snapshot = coalesce(tier,'none'), hold_days = hold,
      hold_started_at = CASE WHEN NEW.dispute_opened_at IS NULL OR NEW.dispute_resolved_at IS NOT NULL THEN NEW.payment_completed_at END,
      release_eligible_at = CASE WHEN NEW.dispute_opened_at IS NULL OR NEW.dispute_resolved_at IS NOT NULL THEN NEW.payment_completed_at + make_interval(days => hold) END
    WHERE id = s.id RETURNING * INTO s;
    INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (s.id, 'hold_snapshot', jsonb_build_object('tier', s.verification_tier_snapshot, 'hold_days', hold));
  END IF;
  -- Dispute resolved: restart hold from resolution.
  IF NEW.dispute_resolved_at IS NOT NULL AND s.dispute_resolved_at IS DISTINCT FROM NEW.dispute_resolved_at AND s.hold_days IS NOT NULL THEN
    UPDATE public.network_settlements SET hold_started_at = NEW.dispute_resolved_at, release_eligible_at = NEW.dispute_resolved_at + make_interval(days => s.hold_days) WHERE id = s.id RETURNING * INTO s;
  END IF;
  st := CASE
    WHEN NEW.network_payment_state = 'refunded' THEN 'refunded'
    WHEN NEW.network_payment_state = 'failed' THEN 'failed'
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
CREATE TRIGGER network_settlement_sync AFTER INSERT OR UPDATE ON public.trip_distributions FOR EACH ROW EXECUTE FUNCTION public.network_settlement_sync();

-- Backfill any already-accepted referrals.
UPDATE public.trip_distributions SET updated_at = updated_at WHERE selected_offer_id IS NOT NULL;

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
    'transferred', s.transfer_ref IS NOT NULL, 'paid_out', s.payout_ref IS NOT NULL, 'stripe_environment', s.stripe_environment,
    'state', s.state, 'created_at', s.created_at,
    'events', (SELECT coalesce(jsonb_agg(jsonb_build_object('event_type', e.event_type, 'actor_mfn_id', e.actor_mfn_id, 'created_at', e.created_at) ORDER BY e.created_at), '[]'::jsonb) FROM public.network_settlement_events e WHERE e.settlement_id = s.id)
  ) ORDER BY s.created_at DESC), '[]'::jsonb)
  FROM public.network_settlements s
  WHERE public.network_workspace_access(s.receiver_workspace_id,false) OR public.network_workspace_access(s.sender_workspace_id,false)
     OR (public.admin_can('network','read') AND (public.admin_can_account(s.sender_workspace_id) OR public.admin_can_account(s.receiver_workspace_id)));
$$;
REVOKE ALL ON FUNCTION public.network_list_settlements() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.network_list_settlements() TO authenticated;

-- Sender records payment-responsibility acknowledgement on its own distribution.
CREATE OR REPLACE FUNCTION public.network_ack_payment_responsibility(_distribution uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.trip_distributions;
BEGIN
  SELECT * INTO d FROM public.trip_distributions WHERE id=_distribution FOR UPDATE;
  IF d.id IS NULL OR d.source_workspace_id IS NULL OR NOT public.network_workspace_access(d.source_workspace_id,true) THEN RAISE EXCEPTION 'Not available'; END IF;
  IF d.payment_responsibility_ack_at IS NULL THEN UPDATE public.trip_distributions SET payment_responsibility_ack_at=now(), payment_responsibility_ack_by=auth.uid() WHERE id=d.id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.network_ack_payment_responsibility(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.network_ack_payment_responsibility(uuid) TO authenticated;

-- Dispute foundation: sender, during the 24h window, records category + safe explanation.
CREATE OR REPLACE FUNCTION public.network_file_dispute(_settlement uuid, _category text, _explanation text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.network_settlements;
BEGIN
  SELECT * INTO s FROM public.network_settlements WHERE id=_settlement FOR UPDATE;
  IF s.id IS NULL OR NOT public.network_workspace_access(s.sender_workspace_id,true) THEN RAISE EXCEPTION 'Not available'; END IF;
  IF s.completed_at IS NULL OR now() > s.review_window_ends_at THEN RAISE EXCEPTION 'The 24-hour review window is not open'; END IF;
  IF EXISTS(SELECT 1 FROM public.network_disputes WHERE settlement_id=s.id AND status='open') THEN RAISE EXCEPTION 'A dispute is already open'; END IF;
  IF _category NOT IN ('completion_missing','service_not_completed','amount_incorrect','security_issue') THEN RAISE EXCEPTION 'Invalid category'; END IF;
  INSERT INTO public.network_disputes(settlement_id, category, explanation) VALUES (s.id, _category, nullif(trim(_explanation),''));
  UPDATE public.trip_distributions SET dispute_opened_at=now(), dispute_reason_code=_category, updated_at=now() WHERE id=s.distribution_id AND dispute_opened_at IS NULL;
  INSERT INTO public.network_settlement_events(settlement_id, event_type, details) VALUES (s.id, 'dispute_opened', jsonb_build_object('category',_category));
END $$;
REVOKE ALL ON FUNCTION public.network_file_dispute(uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.network_file_dispute(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.network_list_disputes() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'settlement_mfn_id',s.mfn_id,'category',d.category,'status',d.status,'created_at',d.created_at,'sender',s.sender_workspace_mfn_id,'receiver',s.receiver_workspace_mfn_id) ORDER BY d.created_at DESC),'[]'::jsonb)
  FROM public.network_disputes d JOIN public.network_settlements s ON s.id=d.settlement_id
  WHERE public.admin_can('network','read') AND (public.admin_can_account(s.sender_workspace_id) OR public.admin_can_account(s.receiver_workspace_id));
$$;
REVOKE ALL ON FUNCTION public.network_list_disputes() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.network_list_disputes() TO authenticated;