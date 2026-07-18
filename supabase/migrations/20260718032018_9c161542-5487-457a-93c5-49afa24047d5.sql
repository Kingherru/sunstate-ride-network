
-- ============================================================
-- Finance monitoring + admin audit trail
-- ============================================================

-- Cron run log
CREATE TABLE IF NOT EXISTS public.fin_cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ok boolean NOT NULL DEFAULT false,
  processed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  error_text text,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_cron_runs_job_idx ON public.fin_cron_runs(job_name, started_at DESC);
GRANT SELECT ON public.fin_cron_runs TO authenticated;
GRANT ALL ON public.fin_cron_runs TO service_role;
ALTER TABLE public.fin_cron_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read cron runs" ON public.fin_cron_runs;
CREATE POLICY "admin read cron runs" ON public.fin_cron_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Admin action audit
CREATE TABLE IF NOT EXISTS public.fin_admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  trip_id uuid,
  provider_user_id uuid,
  amount_cents bigint,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_admin_actions_created_idx ON public.fin_admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS fin_admin_actions_trip_idx ON public.fin_admin_actions(trip_id);
GRANT SELECT ON public.fin_admin_actions TO authenticated;
GRANT ALL ON public.fin_admin_actions TO service_role;
ALTER TABLE public.fin_admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read admin actions" ON public.fin_admin_actions;
CREATE POLICY "admin read admin actions" ON public.fin_admin_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Helper: append an audit row (service definer)
CREATE OR REPLACE FUNCTION public._fin_log_admin(
  _action text, _trip_id uuid, _provider uuid, _amount_cents bigint,
  _reason text, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.fin_admin_actions(admin_user_id, action, trip_id, provider_user_id, amount_cents, reason, metadata)
  VALUES (auth.uid(), _action, _trip_id, _provider, _amount_cents, _reason, COALESCE(_metadata,'{}'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public._fin_log_admin(text,uuid,uuid,bigint,text,jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._fin_log_admin(text,uuid,uuid,bigint,text,jsonb) TO service_role;

-- Record a cron run (called by service role from tick routes)
CREATE OR REPLACE FUNCTION public.fin_record_cron_run(
  _job text, _ok boolean, _processed int, _failed int,
  _error text DEFAULT NULL, _triggered_by text DEFAULT 'cron',
  _started_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.fin_cron_runs(job_name, started_at, ended_at, ok, processed, failed, error_text, triggered_by)
  VALUES (_job, COALESCE(_started_at, now()), now(), _ok, _processed, _failed, _error, _triggered_by)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.fin_record_cron_run(text,boolean,int,int,text,text,timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_record_cron_run(text,boolean,int,int,text,text,timestamptz) TO service_role;

-- Cron status summary view for admins
DROP VIEW IF EXISTS public.admin_fin_cron_status;
CREATE VIEW public.admin_fin_cron_status AS
WITH latest AS (
  SELECT DISTINCT ON (job_name) job_name, started_at, ended_at, ok, processed, failed, error_text, triggered_by
  FROM public.fin_cron_runs ORDER BY job_name, started_at DESC
),
lastok AS (
  SELECT DISTINCT ON (job_name) job_name, started_at AS last_success_at
  FROM public.fin_cron_runs WHERE ok = true
  ORDER BY job_name, started_at DESC
),
errcount AS (
  SELECT job_name, COUNT(*)::int AS errors_24h
  FROM public.fin_cron_runs
  WHERE ok = false AND started_at > now() - INTERVAL '24 hours'
  GROUP BY job_name
)
SELECT
  l.job_name, l.started_at AS last_run_at, l.ended_at AS last_ended_at,
  l.ok AS last_ok, l.processed AS last_processed, l.failed AS last_failed,
  l.error_text AS last_error, l.triggered_by AS last_triggered_by,
  o.last_success_at, COALESCE(e.errors_24h,0) AS errors_24h
FROM latest l
LEFT JOIN lastok o USING (job_name)
LEFT JOIN errcount e USING (job_name);
GRANT SELECT ON public.admin_fin_cron_status TO authenticated;

-- ---------- Rewrap admin RPCs to write audit ----------
CREATE OR REPLACE FUNCTION public.fin_admin_force_release(_trip_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.trips SET fin_payout_hold_until = now() - INTERVAL '1 minute'
    WHERE id=_trip_id AND fin_payout_state='holding';
  PERFORM public.fin_release_to_balance(_trip_id);
  PERFORM public._fin_log_admin('force_release', _trip_id, NULL, NULL, _reason, '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.fin_admin_force_release(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_force_release(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fin_refund(_trip_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; total_reversed bigint := 0; prov uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  FOR e IN SELECT * FROM public.provider_balance_entries
           WHERE trip_id=_trip_id AND state IN ('pending','available') FOR UPDATE LOOP
    prov := e.provider_user_id;
    total_reversed := total_reversed + e.amount_cents;
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
  PERFORM public._fin_log_admin('refund', _trip_id, prov, total_reversed, _reason,
    jsonb_build_object('reversed_cents', total_reversed));
END $$;
REVOKE ALL ON FUNCTION public.fin_refund(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_refund(uuid,text) TO authenticated, service_role;

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
  PERFORM public._fin_log_admin('balance_adjust', NULL, _provider, _amount_cents, _note, '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.fin_admin_adjust_balance(uuid,bigint,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_adjust_balance(uuid,bigint,text) TO authenticated, service_role;

-- New: fee adjust on a trip (platform and/or referral). Recomputes provider net
-- and updates any *pending* ledger entry for this trip. Refuses when the trip
-- has already been released to balance (use adjust_balance for corrections).
CREATE OR REPLACE FUNCTION public.fin_admin_fee_adjust(
  _trip_id uuid,
  _new_platform_cents bigint DEFAULT NULL,
  _new_referral_cents bigint DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record; new_platform bigint; new_referral bigint; new_net bigint; delta bigint;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO t FROM public.trips WHERE id=_trip_id FOR UPDATE;
  IF t IS NULL THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.fin_payout_state IN ('released_to_balance','paid_out','cashed_out') THEN
    RAISE EXCEPTION 'Trip already released — use balance adjustment instead';
  END IF;
  new_platform := COALESCE(_new_platform_cents, t.fin_platform_fee_cents, 0);
  new_referral := COALESCE(_new_referral_cents, t.fin_referral_fee_cents, 0);
  new_net := GREATEST(0, COALESCE(t.fin_gross_cents,0) - new_platform - new_referral);
  delta := new_net - COALESCE(t.fin_provider_net_cents,0);

  UPDATE public.trips SET
    fin_platform_fee_cents = new_platform,
    fin_referral_fee_cents = new_referral,
    fin_provider_net_cents = new_net
  WHERE id=_trip_id;

  -- Patch pending ledger entry (if trip currently in holding state)
  IF delta <> 0 THEN
    UPDATE public.provider_balance_entries
      SET amount_cents = amount_cents + delta, updated_at=now()
      WHERE trip_id=_trip_id AND state='pending' AND kind='hold';
    IF FOUND THEN
      UPDATE public.provider_balances
        SET pending_cents = GREATEST(0, pending_cents + delta), updated_at=now()
        WHERE provider_user_id = t.assigned_to;
    END IF;
  END IF;

  PERFORM public._fin_log_admin('fee_adjust', _trip_id, t.assigned_to, delta, _reason,
    jsonb_build_object(
      'new_platform_cents', new_platform,
      'new_referral_cents', new_referral,
      'new_provider_net_cents', new_net,
      'delta_provider_net_cents', delta
    ));
END $$;
REVOKE ALL ON FUNCTION public.fin_admin_fee_adjust(uuid,bigint,bigint,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_fee_adjust(uuid,bigint,bigint,text) TO authenticated, service_role;

-- Admin: list recent audit entries
CREATE OR REPLACE FUNCTION public.fin_admin_recent_actions(_limit int DEFAULT 100)
RETURNS SETOF public.fin_admin_actions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT * FROM public.fin_admin_actions ORDER BY created_at DESC LIMIT GREATEST(1, LEAST(_limit,500));
END $$;
REVOKE ALL ON FUNCTION public.fin_admin_recent_actions(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fin_admin_recent_actions(int) TO authenticated, service_role;
