REVOKE SELECT ON public.expiring_provider_credentials FROM authenticated;
ALTER VIEW public.expiring_provider_credentials SET (security_invoker = on);