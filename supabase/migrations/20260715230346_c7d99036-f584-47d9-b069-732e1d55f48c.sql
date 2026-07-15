DROP POLICY IF EXISTS "Owners manage their vehicles" ON public.vehicles;
CREATE POLICY "Owners manage their vehicles" ON public.vehicles
FOR ALL TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));