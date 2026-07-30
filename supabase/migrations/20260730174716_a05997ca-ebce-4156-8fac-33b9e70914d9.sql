CREATE OR REPLACE FUNCTION public.fin_validate_payment(_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record; s record; hold_until timestamptz; provider uuid; net_cents int;
  ref_user uuid; ref_cents int;
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

  -- Referral payout: money OWED TO the referring provider, never a charge.
  ref_user := COALESCE(t.referral_fee_source_user_id, NULL);
  ref_cents := GREATEST(0, COALESCE(t.fin_referral_fee_cents, 0));
  IF ref_user IS NOT NULL AND ref_user <> provider AND ref_cents > 0 THEN
    INSERT INTO public.provider_balance_entries(provider_user_id,trip_id,kind,amount_cents,state,available_at,note)
    VALUES (ref_user, _trip_id, 'hold', ref_cents, 'pending', hold_until, 'Referral payout');

    INSERT INTO public.provider_balances(provider_user_id, pending_cents, updated_at)
    VALUES (ref_user, ref_cents, now())
    ON CONFLICT (provider_user_id) DO UPDATE SET
      pending_cents = provider_balances.pending_cents + EXCLUDED.pending_cents,
      updated_at = now();
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.fin_validate_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_validate_payment(uuid) TO authenticated, service_role;