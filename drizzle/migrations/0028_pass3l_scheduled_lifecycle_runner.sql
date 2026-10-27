CREATE OR REPLACE FUNCTION public.provider_verification_scheduled_run() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE expired_count int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(742302) THEN RETURN jsonb_build_object('skipped','locked'); END IF;
  PERFORM public.provider_verification_lifecycle();
  -- Internal audit only: a pending email-change request with no terminal event after 24h
  -- is marked expired in the app's audit trail. Auth records and account emails are never touched.
  WITH latest AS (
    SELECT DISTINCT ON (user_id) user_id, event_type, correlation_id, created_at
    FROM public.account_security_audit
    WHERE event_type LIKE 'email_change_%'
    ORDER BY user_id, created_at DESC, id DESC
  ), ins AS (
    INSERT INTO public.account_security_audit(user_id, sender_mfn_id, event_type, result, correlation_id)
    SELECT l.user_id, p.mfn_id, 'email_change_expired', 'internal_request_expired', l.correlation_id
    FROM latest l JOIN public.user_profiles p ON p.user_id = l.user_id
    WHERE l.event_type = 'email_change_requested'
      AND l.created_at < now() - interval '24 hours'
    RETURNING 1
  ) SELECT count(*) INTO expired_count FROM ins;
  RETURN jsonb_build_object('ran_at', timezone('America/New_York', now()), 'email_requests_expired', expired_count);
END $$;
REVOKE ALL ON FUNCTION public.provider_verification_scheduled_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_verification_scheduled_run() TO service_role;
COMMENT ON FUNCTION public.provider_verification_scheduled_run() IS 'Hourly pg_cron runner: lifecycle states, recalculation, in-app notices, audit-only email-change expiry. Never charges, emails or changes access.';