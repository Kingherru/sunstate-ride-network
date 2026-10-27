REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.request_status_events FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.platform_launch_flags FROM authenticated, anon;
REVOKE ALL ON public.request_status_events FROM anon;
REVOKE ALL ON public.platform_launch_flags FROM anon;