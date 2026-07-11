
REVOKE ALL ON FUNCTION public.gen_webhook_secret() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enqueue_provider_webhook_event(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enqueue_platform_webhook_event(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_provider_webhook_event(uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_platform_webhook_event(text, jsonb) TO authenticated, service_role;
