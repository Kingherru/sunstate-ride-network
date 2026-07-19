
-- 1) Set security_invoker on the two remaining views
ALTER VIEW public.admin_fin_ledger SET (security_invoker = on);
ALTER VIEW public.admin_fin_cron_status SET (security_invoker = on);

-- 2) Pin search_path on trigger function fin_block_cashout_writes
CREATE OR REPLACE FUNCTION public.fin_block_cashout_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF current_setting('role') <> 'service_role' AND session_user <> current_user THEN
    IF pg_trigger_depth() = 1 AND current_setting('request.jwt.claims', true) IS NOT NULL THEN
      RAISE EXCEPTION 'Cashouts must go through fin_request_cashout';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 3) Revoke EXECUTE from anon/public on SECURITY DEFINER functions that shouldn't be publicly callable
REVOKE EXECUTE ON FUNCTION public.fin_block_direct_trip_writes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fin_snapshot_on_create() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fin_get_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_get_settings() TO service_role;
-- Trigger functions don't need explicit grants for trigger invocation.

-- 4) Block non-service authenticated users from writing cost_total on trips.
--    Extends the existing fin_block_direct_trip_writes trigger to also protect cost_total,
--    which the payout pipeline reads when releasing Stripe transfers.
CREATE OR REPLACE FUNCTION public.fin_block_direct_trip_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
  v_uid uuid;
BEGIN
  IF v_claims IS NOT NULL THEN
    v_role := (v_claims::jsonb ->> 'role');
    BEGIN v_uid := ((v_claims::jsonb ->> 'sub'))::uuid; EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;
  END IF;

  -- service_role bypass, but still enforce lock after payout
  IF v_claims IS NULL OR v_role = 'service_role' THEN
    IF OLD.fin_locked_at IS NOT NULL AND (
      NEW.fin_gross_cents IS DISTINCT FROM OLD.fin_gross_cents
      OR NEW.fin_platform_fee_cents IS DISTINCT FROM OLD.fin_platform_fee_cents
      OR NEW.fin_referral_fee_cents IS DISTINCT FROM OLD.fin_referral_fee_cents
      OR NEW.fin_provider_net_cents IS DISTINCT FROM OLD.fin_provider_net_cents
    ) THEN
      RAISE EXCEPTION 'Trip finance amounts are locked after payout.';
    END IF;
    RETURN NEW;
  END IF;

  -- Admin, dispatcher, and app_manager can update cost_total (ops adjustments).
  -- Anyone else (creators, assigned providers) cannot change cost_total once set.
  IF NEW.cost_total IS DISTINCT FROM OLD.cost_total THEN
    IF v_uid IS NULL OR NOT public.has_any_role(
      v_uid,
      ARRAY['admin'::app_role, 'dispatcher'::app_role, 'app_manager'::app_role]
    ) THEN
      RAISE EXCEPTION 'Trip cost_total can only be changed by ops staff.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- Any authenticated user: forbid editing fin_* columns entirely.
  IF NEW.fin_gross_cents IS DISTINCT FROM OLD.fin_gross_cents
     OR NEW.fin_platform_fee_bps IS DISTINCT FROM OLD.fin_platform_fee_bps
     OR NEW.fin_platform_fee_cents IS DISTINCT FROM OLD.fin_platform_fee_cents
     OR NEW.fin_referral_fee_bps IS DISTINCT FROM OLD.fin_referral_fee_bps
     OR NEW.fin_referral_fee_cents IS DISTINCT FROM OLD.fin_referral_fee_cents
     OR NEW.fin_provider_net_cents IS DISTINCT FROM OLD.fin_provider_net_cents
     OR NEW.fin_payer_kind IS DISTINCT FROM OLD.fin_payer_kind
     OR NEW.fin_payer_user_id IS DISTINCT FROM OLD.fin_payer_user_id
     OR NEW.fin_payment_source IS DISTINCT FROM OLD.fin_payment_source
     OR NEW.fin_payment_state IS DISTINCT FROM OLD.fin_payment_state
     OR NEW.fin_payout_state IS DISTINCT FROM OLD.fin_payout_state
     OR NEW.fin_is_medicaid IS DISTINCT FROM OLD.fin_is_medicaid
     OR NEW.fin_medicaid_funds_received_at IS DISTINCT FROM OLD.fin_medicaid_funds_received_at
     OR NEW.fin_payout_hold_until IS DISTINCT FROM OLD.fin_payout_hold_until
     OR NEW.fin_completed_at IS DISTINCT FROM OLD.fin_completed_at
     OR NEW.fin_locked_at IS DISTINCT FROM OLD.fin_locked_at THEN
    RAISE EXCEPTION 'Trip finance fields can only be changed by the payment service.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

-- 5) Add admin SELECT policy to email_send_state for visibility
DROP POLICY IF EXISTS "Admins view email throttling state" ON public.email_send_state;
CREATE POLICY "Admins view email throttling state"
  ON public.email_send_state
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) Rotate the cron shared secret and reschedule fin ticks with the private secret in a x-cron-secret header
--    (matches process.env.FIN_CRON_SECRET verified inside the route handlers).
DO $mig$
DECLARE
  v_secret_value text := '73271807b7663d610c96de4ab68f3565e0423865a33dd742892a666740b18056';
  v_existing uuid;
  v_base text := 'https://project--ehhxvjmiqobojslbwvij.lovable.app';
BEGIN
  SELECT id INTO v_existing FROM vault.secrets WHERE name = 'fin_cron_secret';
  IF v_existing IS NULL THEN
    PERFORM vault.create_secret(v_secret_value, 'fin_cron_secret');
  ELSE
    PERFORM vault.update_secret(v_existing, v_secret_value, 'fin_cron_secret');
  END IF;

  BEGIN PERFORM cron.unschedule('release-eligible-payouts'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('fin-release-tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('fin-cashout-tick'); EXCEPTION WHEN OTHERS THEN NULL; END;

  PERFORM cron.schedule(
    'release-eligible-payouts',
    '*/15 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fin_cron_secret')
        ),
        body := '{}'::jsonb
      );
    $job$, v_base || '/api/public/hooks/release-eligible-payouts')
  );

  PERFORM cron.schedule(
    'fin-release-tick',
    '*/15 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fin_cron_secret')
        ),
        body := '{}'::jsonb
      );
    $job$, v_base || '/api/public/hooks/fin-release-tick')
  );

  PERFORM cron.schedule(
    'fin-cashout-tick',
    '*/5 * * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fin_cron_secret')
        ),
        body := '{}'::jsonb
      );
    $job$, v_base || '/api/public/hooks/fin-cashout-tick')
  );
END $mig$;
