-- Trigger functions: never need direct EXECUTE by API roles
REVOKE ALL ON FUNCTION public.block_vacation_driver_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_auto_referral_target() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trips_auto_assign_provider() FROM PUBLIC, anon, authenticated;

-- Internal automation helpers: not callable by anonymous visitors
REVOKE ALL ON FUNCTION public.auto_assign_trip(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pick_auto_provider(text, uuid, uuid, boolean, text, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.auto_assign_trip(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pick_auto_provider(text, uuid, uuid, boolean, text, boolean) TO service_role;