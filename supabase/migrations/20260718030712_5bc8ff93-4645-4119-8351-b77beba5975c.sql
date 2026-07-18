
-- ============================================================
-- FINANCE REBUILD (Provider Balance model)
-- ============================================================

-- ---------- Settings ----------
ALTER TABLE public.fin_settings
  ADD COLUMN IF NOT EXISTS standard_hold_days int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS medicaid_net_business_days int NOT NULL DEFAULT 15;

-- ---------- Enum extensions ----------
DO $$ BEGIN
  ALTER TYPE public.fin_payout_state ADD VALUE IF NOT EXISTS 'released_to_balance' AFTER 'releasable';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.fin_payout_state ADD VALUE IF NOT EXISTS 'cashed_out' AFTER 'paid_out';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_ledger_kind AS ENUM ('hold','release','cashout','reversal','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_ledger_state AS ENUM ('pending','available','paid_out','reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fin_cashout_status AS ENUM ('requested','processing','paid','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Bank holidays ----------
CREATE TABLE IF NOT EXISTS public.fin_bank_holidays (
  holiday_date date PRIMARY KEY,
  label text NOT NULL
);
GRANT SELECT ON public.fin_bank_holidays TO authenticated;
GRANT ALL ON public.fin_bank_holidays TO service_role;
ALTER TABLE public.fin_bank_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read bank holidays" ON public.fin_bank_holidays;
CREATE POLICY "read bank holidays" ON public.fin_bank_holidays FOR SELECT TO authenticated USING (true);

INSERT INTO public.fin_bank_holidays(holiday_date, label) VALUES
  ('2026-01-01','New Year''s Day'),('2026-01-19','MLK Day'),('2026-02-16','Presidents Day'),
  ('2026-05-25','Memorial Day'),('2026-06-19','Juneteenth'),('2026-07-03','Independence Day (observed)'),
  ('2026-09-07','Labor Day'),('2026-10-12','Columbus Day'),('2026-11-11','Veterans Day'),
  ('2026-11-26','Thanksgiving'),('2026-12-25','Christmas'),
  ('2027-01-01','New Year''s Day'),('2027-01-18','MLK Day'),('2027-02-15','Presidents Day'),
  ('2027-05-31','Memorial Day'),('2027-06-18','Juneteenth (observed)'),('2027-07-05','Independence Day (observed)'),
  ('2027-09-06','Labor Day'),('2027-10-11','Columbus Day'),('2027-11-11','Veterans Day'),
  ('2027-11-25','Thanksgiving'),('2027-12-24','Christmas (observed)'),
  ('2028-01-17','MLK Day'),('2028-02-21','Presidents Day'),('2028-05-29','Memorial Day'),
  ('2028-06-19','Juneteenth'),('2028-07-04','Independence Day'),('2028-09-04','Labor Day'),
  ('2028-10-09','Columbus Day'),('2028-11-10','Veterans Day (observed)'),('2028-11-23','Thanksgiving'),('2028-12-25','Christmas')
ON CONFLICT (holiday_date) DO NOTHING;

-- ---------- Business-day helper ----------
CREATE OR REPLACE FUNCTION public.fin_business_days_from(_start timestamptz, _days int)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d date := (_start AT TIME ZONE 'America/New_York')::date; added int := 0;
BEGIN
  WHILE added < _days LOOP
    d := d + 1;
    IF EXTRACT(ISODOW FROM d) < 6
       AND NOT EXISTS (SELECT 1 FROM public.fin_bank_holidays WHERE holiday_date = d) THEN
      added := added + 1;
    END IF;
  END LOOP;
  RETURN (d + INTERVAL '17 hours') AT TIME ZONE 'America/New_York';
END $$;
REVOKE ALL ON FUNCTION public.fin_business_days_from(timestamptz,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_business_days_from(timestamptz,int) TO authenticated, service_role;

-- ---------- Provider Balances ----------
CREATE TABLE IF NOT EXISTS public.provider_balances (
  provider_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available_cents bigint NOT NULL DEFAULT 0 CHECK (available_cents >= 0),
  pending_cents bigint NOT NULL DEFAULT 0 CHECK (pending_cents >= 0),
  lifetime_paid_out_cents bigint NOT NULL DEFAULT 0 CHECK (lifetime_paid_out_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_balances TO authenticated;
GRANT ALL ON public.provider_balances TO service_role;
ALTER TABLE public.provider_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own balance" ON public.provider_balances;
CREATE POLICY "own balance" ON public.provider_balances FOR SELECT TO authenticated
  USING (provider_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ---------- Cashouts ----------
CREATE TABLE IF NOT EXISTS public.provider_cashouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status public.fin_cashout_status NOT NULL DEFAULT 'requested',
  stripe_transfer_id text,
  failure_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_cashouts_provider_idx ON public.provider_cashouts(provider_user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS provider_cashouts_status_idx ON public.provider_cashouts(status) WHERE status IN ('requested','processing');
GRANT SELECT ON public.provider_cashouts TO authenticated;
GRANT ALL ON public.provider_cashouts TO service_role;
ALTER TABLE public.provider_cashouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own cashouts" ON public.provider_cashouts;
CREATE POLICY "own cashouts" ON public.provider_cashouts FOR SELECT TO authenticated
  USING (provider_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Prevent any direct writes from authenticated
CREATE OR REPLACE FUNCTION public.fin_block_cashout_writes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('role') <> 'service_role' AND session_user <> current_user THEN
    -- allow only if invoked via SECURITY DEFINER rpc
    IF pg_trigger_depth() = 1 AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
      RAISE EXCEPTION 'Cashouts must go through fin_request_cashout';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ---------- Ledger ----------
CREATE TABLE IF NOT EXISTS public.provider_balance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  cashout_id uuid REFERENCES public.provider_cashouts(id) ON DELETE SET NULL,
  kind public.fin_ledger_kind NOT NULL,
  amount_cents bigint NOT NULL,
  state public.fin_ledger_state NOT NULL,
  available_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pbe_provider_idx ON public.provider_balance_entries(provider_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pbe_trip_idx ON public.provider_balance_entries(trip_id);
CREATE INDEX IF NOT EXISTS pbe_pending_idx ON public.provider_balance_entries(provider_user_id, state) WHERE state = 'pending';
GRANT SELECT ON public.provider_balance_entries TO authenticated;
GRANT ALL ON public.provider_balance_entries TO service_role;
ALTER TABLE public.provider_balance_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own ledger" ON public.provider_balance_entries;
CREATE POLICY "own ledger" ON public.provider_balance_entries FOR SELECT TO authenticated
  USING (provider_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ---------- Trip finance RPCs ----------

-- Set / snapshot trip amounts (admin)
CREATE OR REPLACE FUNCTION public.fin_set_amounts(
  _trip_id uuid, _gross_cents int, _referral_flat_cents int DEFAULT 0,
  _payer_kind public.fin_payer_kind DEFAULT NULL, _payer_user_id uuid DEFAULT NULL,
  _payment_source text DEFAULT NULL, _is_medicaid boolean DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  s record; fee_bps int; ref_bps int; fee_cents int; ref_cents int; net_cents int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT platform_fee_bps INTO s FROM public.fin_settings LIMIT 1;
  fee_bps := COALESCE(s.platform_fee_bps, 200);
  fee_cents := (_gross_cents * fee_bps) / 10000;
  ref_cents := LEAST(GREATEST(_referral_flat_cents,0), _gross_cents - fee_cents);
  ref_bps := CASE WHEN _gross_cents > 0 THEN (ref_cents * 10000) / _gross_cents ELSE 0 END;
  net_cents := GREATEST(0, _gross_cents - fee_cents - ref_cents);

  UPDATE public.trips SET
    fin_gross_cents = _gross_cents,
    fin_platform_fee_bps = fee_bps,
    fin_platform_fee_cents = fee_cents,
    fin_referral_fee_bps = ref_bps,
    fin_referral_fee_cents = ref_cents,
    fin_provider_net_cents = net_cents,
    fin_payer_kind = COALESCE(_payer_kind, fin_payer_kind),
    fin_payer_user_id = COALESCE(_payer_user_id, fin_payer_user_id),
    fin_payment_source = COALESCE(_payment_source, fin_payment_source),
    fin_is_medicaid = COALESCE(_is_medicaid, fin_is_medicaid, false)
  WHERE id = _trip_id;
END $$;
REVOKE ALL ON FUNCTION public.fin_set_amounts(uuid,int,int,public.fin_payer_kind,uuid,text,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_set_amounts(uuid,int,int,public.fin_payer_kind,uuid,text,boolean) TO authenticated, service_role;

-- Mark paid (called by Stripe webhook or admin)
CREATE OR REPLACE FUNCTION public.fin_mark_paid(_trip_id uuid, _source text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.trips SET
    fin_payment_state = 'paid',
    fin_payment_source = COALESCE(_source, fin_payment_source)
  WHERE id = _trip_id AND fin_payment_state IN ('none','invoiced');
END $$;
REVOKE ALL ON FUNCTION public.fin_mark_paid(uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_mark_paid(uuid,text) TO service_role;

-- Validate payment: compute hold, create pending ledger entry, bump pending balance
CREATE OR REPLACE FUNCTION public.fin_validate_payment(_trip_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  t record; s record; hold_until timestamptz; provider uuid; net_cents int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id FOR UPDATE;
  IF t IS NULL THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.fin_payment_state NOT IN ('paid','validated') THEN
    RAISE EXCEPTION 'Trip payment not captured';
  END IF;
  IF t.fin_payout_state <> 'none' THEN
    RAISE EXCEPTION 'Payout already initiated';
  END IF;
  provider := t.assigned_to;
  IF provider IS NULL THEN RAISE EXCEPTION 'No provider assigned'; END IF;
  net_cents := COALESCE(t.fin_provider_net_cents, 0);
  IF net_cents <= 0 THEN RAISE EXCEPTION 'Provider net is zero'; END IF;

  SELECT * INTO s FROM public.fin_settings LIMIT 1;

  IF COALESCE(t.fin_is_medicaid,false) THEN
    IF t.fin_medicaid_funds_received_at IS NULL THEN
      -- Medicaid without funds-received: park in holding with no release date
      hold_until := NULL;
    ELSE
      hold_until := public.fin_business_days_from(t.fin_medicaid_funds_received_at, COALESCE(s.medicaid_net_business_days,15));
    END IF;
  ELSE
    hold_until := now() + make_interval(days => COALESCE(s.standard_hold_days,3));
  END IF;

  UPDATE public.trips SET
    fin_payment_state = 'validated',
    fin_payout_state = 'holding',
    fin_payout_hold_until = hold_until
  WHERE id = _trip_id;

  INSERT INTO public.provider_balance_entries(provider_user_id,trip_id,kind,amount_cents,state,available_at,note)
  VALUES (provider, _trip_id, 'hold', net_cents, 'pending', hold_until,
          CASE WHEN t.fin_is_medicaid THEN 'Medicaid Net-15' ELSE 'Standard 3-day hold' END);

  INSERT INTO public.provider_balances(provider_user_id, pending_cents, updated_at)
  VALUES (provider, net_cents, now())
  ON CONFLICT (provider_user_id) DO UPDATE SET
    pending_cents = provider_balances.pending_cents + EXCLUDED.pending_cents,
    updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.fin_validate_payment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_validate_payment(uuid) TO authenticated, service_role;

-- Mark Medicaid funds received
CREATE OR REPLACE FUNCTION public.fin_mark_medicaid_received(_trip_id uuid, _received_at timestamptz DEFAULT now())
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record; s record; hold_until timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO t FROM public.trips WHERE id=_trip_id FOR UPDATE;
  IF NOT COALESCE(t.fin_is_medicaid,false) THEN RAISE EXCEPTION 'Not a Medicaid trip'; END IF;
  SELECT * INTO s FROM public.fin_settings LIMIT 1;
  hold_until := public.fin_business_days_from(_received_at, COALESCE(s.medicaid_net_business_days,15));
  UPDATE public.trips SET
    fin_medicaid_funds_received_at = _received_at,
    fin_payout_hold_until = CASE WHEN fin_payout_state='holding' THEN hold_until ELSE fin_payout_hold_until END
  WHERE id=_trip_id;
  UPDATE public.provider_balance_entries
    SET available_at = hold_until, updated_at = now()
  WHERE trip_id = _trip_id AND state='pending';
END $$;
REVOKE ALL ON FUNCTION public.fin_mark_medicaid_received(uuid,timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_mark_medicaid_received(uuid,timestamptz) TO authenticated, service_role;

-- Release trip payout to provider balance (pending -> available)
CREATE OR REPLACE FUNCTION public.fin_release_to_balance(_trip_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record; e record;
BEGIN
  SELECT * INTO t FROM public.trips WHERE id=_trip_id FOR UPDATE;
  IF t IS NULL OR t.fin_payout_state <> 'holding' THEN RETURN; END IF;
  IF t.fin_payout_hold_until IS NULL OR t.fin_payout_hold_until > now() THEN RETURN; END IF;
  IF t.fin_payment_state <> 'validated' THEN RETURN; END IF;

  FOR e IN SELECT * FROM public.provider_balance_entries WHERE trip_id=_trip_id AND state='pending' FOR UPDATE LOOP
    UPDATE public.provider_balance_entries SET state='available', updated_at=now() WHERE id=e.id;
    UPDATE public.provider_balances SET
      pending_cents = GREATEST(0, pending_cents - e.amount_cents),
      available_cents = available_cents + e.amount_cents,
      updated_at = now()
    WHERE provider_user_id = e.provider_user_id;
  END LOOP;

  UPDATE public.trips SET fin_payout_state='released_to_balance' WHERE id=_trip_id;
END $$;
REVOKE ALL ON FUNCTION public.fin_release_to_balance(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_release_to_balance(uuid) TO service_role;

-- Admin force release (bypass hold clock)
CREATE OR REPLACE FUNCTION public.fin_admin_force_release(_trip_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.trips SET fin_payout_hold_until = now() - INTERVAL '1 minute'
    WHERE id=_trip_id AND fin_payout_state='holding';
  PERFORM public.fin_release_to_balance(_trip_id);
END $$;
REVOKE ALL ON FUNCTION public.fin_admin_force_release(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_force_release(uuid) TO authenticated, service_role;

-- Refund a trip
CREATE OR REPLACE FUNCTION public.fin_refund(_trip_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  FOR e IN SELECT * FROM public.provider_balance_entries
           WHERE trip_id=_trip_id AND state IN ('pending','available') FOR UPDATE LOOP
    IF e.state = 'pending' THEN
      UPDATE public.provider_balances SET
        pending_cents = GREATEST(0, pending_cents - e.amount_cents), updated_at=now()
      WHERE provider_user_id = e.provider_user_id;
    ELSE
      UPDATE public.provider_balances SET
        available_cents = GREATEST(0, available_cents - e.amount_cents), updated_at=now()
      WHERE provider_user_id = e.provider_user_id;
    END IF;
    UPDATE public.provider_balance_entries SET state='reversed', updated_at=now() WHERE id=e.id;
    INSERT INTO public.provider_balance_entries(provider_user_id,trip_id,kind,amount_cents,state,note)
    VALUES (e.provider_user_id, _trip_id, 'reversal', -e.amount_cents, 'reversed', COALESCE(_reason,'refund'));
  END LOOP;
  UPDATE public.trips SET
    fin_payment_state = 'refunded',
    fin_payout_state = CASE WHEN fin_payout_state IN ('holding','releasable','released_to_balance') THEN 'cancelled' ELSE fin_payout_state END
  WHERE id=_trip_id;
END $$;
REVOKE ALL ON FUNCTION public.fin_refund(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_refund(uuid,text) TO authenticated, service_role;

-- ---------- Cashout RPCs ----------

CREATE OR REPLACE FUNCTION public.fin_request_cashout(_amount_cents bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b record; uid uuid := auth.uid(); new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _amount_cents < 100 THEN RAISE EXCEPTION 'Minimum cash-out is $1.00'; END IF;
  SELECT * INTO b FROM public.provider_balances WHERE provider_user_id=uid FOR UPDATE;
  IF b IS NULL OR b.available_cents < _amount_cents THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;
  INSERT INTO public.provider_cashouts(provider_user_id,amount_cents) VALUES (uid, _amount_cents) RETURNING id INTO new_id;
  UPDATE public.provider_balances SET
    available_cents = available_cents - _amount_cents, updated_at=now()
  WHERE provider_user_id = uid;
  INSERT INTO public.provider_balance_entries(provider_user_id,cashout_id,kind,amount_cents,state,note)
  VALUES (uid, new_id, 'cashout', -_amount_cents, 'paid_out', 'Cash-out requested');
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.fin_request_cashout(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_request_cashout(bigint) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fin_complete_cashout(_cashout_id uuid, _transfer_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM public.provider_cashouts WHERE id=_cashout_id FOR UPDATE;
  IF c IS NULL OR c.status NOT IN ('requested','processing') THEN RETURN; END IF;
  UPDATE public.provider_cashouts SET
    status='paid', stripe_transfer_id=_transfer_id, completed_at=now(), updated_at=now()
  WHERE id=_cashout_id;
  UPDATE public.provider_balances SET
    lifetime_paid_out_cents = lifetime_paid_out_cents + c.amount_cents, updated_at=now()
  WHERE provider_user_id = c.provider_user_id;
END $$;
REVOKE ALL ON FUNCTION public.fin_complete_cashout(uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_complete_cashout(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fin_fail_cashout(_cashout_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM public.provider_cashouts WHERE id=_cashout_id FOR UPDATE;
  IF c IS NULL OR c.status NOT IN ('requested','processing') THEN RETURN; END IF;
  UPDATE public.provider_cashouts SET status='failed', failure_reason=_reason, updated_at=now() WHERE id=_cashout_id;
  -- Return funds to available
  UPDATE public.provider_balances SET available_cents = available_cents + c.amount_cents, updated_at=now()
    WHERE provider_user_id = c.provider_user_id;
  UPDATE public.provider_balance_entries SET state='reversed', updated_at=now()
    WHERE cashout_id=_cashout_id AND kind='cashout';
  INSERT INTO public.provider_balance_entries(provider_user_id,cashout_id,kind,amount_cents,state,note)
  VALUES (c.provider_user_id, _cashout_id, 'reversal', c.amount_cents, 'available', COALESCE(_reason,'Cash-out failed'));
END $$;
REVOKE ALL ON FUNCTION public.fin_fail_cashout(uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_fail_cashout(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fin_mark_cashout_processing(_cashout_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.provider_cashouts SET status='processing', updated_at=now()
  WHERE id=_cashout_id AND status='requested';
END $$;
REVOKE ALL ON FUNCTION public.fin_mark_cashout_processing(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_mark_cashout_processing(uuid) TO service_role;

-- Admin balance adjustment
CREATE OR REPLACE FUNCTION public.fin_admin_adjust_balance(_provider uuid, _amount_cents bigint, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.provider_balances(provider_user_id, available_cents, updated_at)
  VALUES (_provider, GREATEST(0,_amount_cents), now())
  ON CONFLICT (provider_user_id) DO UPDATE SET
    available_cents = GREATEST(0, provider_balances.available_cents + _amount_cents),
    updated_at = now();
  INSERT INTO public.provider_balance_entries(provider_user_id,kind,amount_cents,state,note)
  VALUES (_provider,'adjustment',_amount_cents,'available',_note);
END $$;
REVOKE ALL ON FUNCTION public.fin_admin_adjust_balance(uuid,bigint,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_adjust_balance(uuid,bigint,text) TO authenticated, service_role;

-- ---------- Admin ledger view ----------
DROP VIEW IF EXISTS public.admin_fin_ledger;
CREATE VIEW public.admin_fin_ledger AS
SELECT t.id AS trip_id, t.created_at, t.status AS trip_status, t.assigned_to AS provider_user_id,
       t.fin_payer_kind, t.fin_is_medicaid, t.fin_gross_cents, t.fin_platform_fee_cents,
       t.fin_referral_fee_cents, t.fin_provider_net_cents,
       t.fin_payment_state, t.fin_payout_state, t.fin_payout_hold_until,
       t.fin_medicaid_funds_received_at, t.fin_payment_source
FROM public.trips t
WHERE t.fin_gross_cents IS NOT NULL AND t.fin_gross_cents > 0;
GRANT SELECT ON public.admin_fin_ledger TO service_role;

-- Lock all fin_* columns on trips to service_role writers
REVOKE UPDATE (
  fin_gross_cents, fin_platform_fee_bps, fin_platform_fee_cents,
  fin_referral_fee_bps, fin_referral_fee_cents, fin_provider_net_cents,
  fin_payment_state, fin_payout_state, fin_payout_hold_until,
  fin_medicaid_funds_received_at, fin_payer_kind, fin_payer_user_id,
  fin_payment_source, fin_is_medicaid, fin_locked_at, fin_completed_at
) ON public.trips FROM anon, authenticated;
