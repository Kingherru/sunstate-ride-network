-- Helper: is this user an approved provider?
CREATE OR REPLACE FUNCTION public.is_approved_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.provider_applications pa
      JOIN auth.users u ON lower(u.email) = lower(pa.email)
     WHERE u.id = _user_id
       AND pa.status = 'approved'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved_provider(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_provider(uuid) TO authenticated;

-- Gate vehicle/driver creation to approved providers (admins always allowed)
DROP POLICY IF EXISTS "Owners manage their vehicles" ON public.vehicles;
CREATE POLICY "Owners manage their vehicles"
  ON public.vehicles
  FOR ALL
  TO authenticated
  USING ((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (
    (
      auth.uid() = owner_id
      AND (public.is_approved_provider(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Owners manage their drivers" ON public.drivers;
CREATE POLICY "Owners manage their drivers"
  ON public.drivers
  FOR ALL
  TO authenticated
  USING ((auth.uid() = owner_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (
    (
      auth.uid() = owner_id
      AND (public.is_approved_provider(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );