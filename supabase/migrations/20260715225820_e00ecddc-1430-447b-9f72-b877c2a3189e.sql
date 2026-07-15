DROP POLICY IF EXISTS "Owners manage their drivers" ON public.drivers;

CREATE POLICY "Owners manage their drivers"
  ON public.drivers
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::app_role));