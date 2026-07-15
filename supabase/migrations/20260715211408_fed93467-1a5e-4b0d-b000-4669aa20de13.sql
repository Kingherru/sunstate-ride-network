REVOKE ALL ON FUNCTION public.ensure_member_display_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_member_display_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_member_display_id() TO service_role;

GRANT EXECUTE ON FUNCTION public.is_approved_provider(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_provider(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

GRANT EXECUTE ON FUNCTION public.is_ops_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ops_staff(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO service_role;

GRANT EXECUTE ON FUNCTION public.manages_zone(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manages_zone(uuid, uuid) TO service_role;
