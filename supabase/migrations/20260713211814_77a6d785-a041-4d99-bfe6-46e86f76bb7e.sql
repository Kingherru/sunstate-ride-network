
-- 1) Fix SECURITY DEFINER view: recreate with security_invoker
ALTER VIEW public.provider_rating_summary SET (security_invoker = on);

-- 2) Fix storage upload policy to require folder ownership
DROP POLICY IF EXISTS "Authenticated users upload provider-docs applications" ON storage.objects;
CREATE POLICY "Authenticated users upload provider-docs applications"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'provider-docs'
  AND (storage.foldername(name))[1] = 'applications'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 3) Lock down SECURITY DEFINER functions: revoke from public/anon.
--    Revoke from authenticated on functions that are trigger-only or admin-only.
REVOKE EXECUTE ON FUNCTION public.accept_trip(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_free_membership(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_approved_quote_to_trip() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_upgrade_patient_to_facility() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_message(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_send_trips(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_trip_quote(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decline_trip(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_member_display_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trips_admin_metadata() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved_provider(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_ops_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_thread_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_expiring_provider_credentials() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_staff_action(text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.manages_zone(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.offer_trip_priority(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_ride_request_to_trip(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.provider_covers_pickup(uuid, double precision, double precision, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.provider_has_valid_credentials(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_priority_offer(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_trip_payment_status(uuid, trip_payment_status) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_direct_thread(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_staff_thread() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_trip_quote(uuid, integer, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_trip_quote(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.suggest_providers_for_trip(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.zone_id_for_zip(text) FROM PUBLIC, anon;
