-- Lock down internal SECURITY DEFINER functions so anonymous callers can't execute them.
-- Both are internal helpers (cron/trigger use); neither should be callable by anon.
REVOKE EXECUTE ON FUNCTION public.escalate_overdue_compliance_reviews() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_member_profile_on_provider_auto_approve() FROM PUBLIC, anon;