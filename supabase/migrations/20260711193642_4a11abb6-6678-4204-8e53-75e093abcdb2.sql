
REVOKE EXECUTE ON FUNCTION public.accept_trip(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decline_trip(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_trip_quote(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decide_trip_quote(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_ride_request_to_trip(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_staff_thread() FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_promote_ride_request() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_trip_payment_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_ride_request_history() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_dispatch_on_new_trip() FROM anon, authenticated, PUBLIC;
