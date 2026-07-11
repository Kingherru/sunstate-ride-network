CREATE POLICY "Ops staff view all saved patients"
  ON public.saved_patients FOR SELECT
  TO authenticated
  USING (public.is_ops_staff(auth.uid()));

CREATE POLICY "Admins view all messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (public.is_ops_staff(auth.uid()));

CREATE POLICY "Ops staff view all subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (public.is_ops_staff(auth.uid()));

CREATE POLICY "Ops staff view all facility saved providers"
  ON public.facility_saved_providers FOR SELECT
  TO authenticated
  USING (public.is_ops_staff(auth.uid()));