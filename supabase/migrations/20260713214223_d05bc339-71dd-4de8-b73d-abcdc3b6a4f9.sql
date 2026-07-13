
REVOKE ALL ON FUNCTION public.admin_user_ids() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_dispatch_thread(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_zone_manager_thread(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_feedback_message(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_dispatch_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_zone_manager_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback_message(text, text, text) TO authenticated;
