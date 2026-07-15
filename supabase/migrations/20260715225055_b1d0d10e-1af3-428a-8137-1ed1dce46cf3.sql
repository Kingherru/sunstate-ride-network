-- Restrict platform_settings reads to admins/app managers; expose only the platform fee to all authenticated users via a SECURITY DEFINER function.

DROP POLICY IF EXISTS "Authenticated can read platform settings" ON public.platform_settings;

CREATE POLICY "Admins and app managers can read platform settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'app_manager'::app_role)
  );

CREATE OR REPLACE FUNCTION public.get_platform_fee_pct()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT platform_fee_pct FROM public.platform_settings WHERE id = true LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_platform_fee_pct() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_platform_fee_pct() TO authenticated;