
ALTER VIEW public.trips_admin_metadata SET (security_invoker = true);
ALTER VIEW public.member_directory SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_send_trips(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_send_trips(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_grant_free_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_free_membership(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_trips_admin_metadata() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trips_admin_metadata() TO authenticated;
