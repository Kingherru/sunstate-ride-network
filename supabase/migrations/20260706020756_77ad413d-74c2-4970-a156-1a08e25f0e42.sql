
DROP POLICY IF EXISTS "zone_zips admin write" ON public.dispatch_zone_zips;
DROP POLICY IF EXISTS "zones admin write" ON public.dispatch_zones;

CREATE POLICY "zone_zips ops write" ON public.dispatch_zone_zips
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','app_manager','zone_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','app_manager','zone_manager']::app_role[]));

CREATE POLICY "zones ops write" ON public.dispatch_zones
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','app_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','app_manager']::app_role[]));

CREATE POLICY "provider_schedule_entries ops read" ON public.provider_schedule_entries
  FOR SELECT TO authenticated
  USING (public.is_ops_staff(auth.uid()));
