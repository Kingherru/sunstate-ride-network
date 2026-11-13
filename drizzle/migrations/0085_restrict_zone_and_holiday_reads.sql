DROP POLICY IF EXISTS "zones readable by authenticated" ON public.dispatch_zones;
CREATE POLICY "zones readable by operations staff" ON public.dispatch_zones FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','staff','app_manager','zone_manager','dispatcher']::public.app_role[]));

DROP POLICY IF EXISTS "zone_zips readable by authenticated" ON public.dispatch_zone_zips;
CREATE POLICY "zone_zips readable by operations staff" ON public.dispatch_zone_zips FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','staff','app_manager','zone_manager','dispatcher']::public.app_role[]));

DROP POLICY IF EXISTS "read bank holidays" ON public.fin_bank_holidays;
CREATE POLICY "bank holidays readable by admins" ON public.fin_bank_holidays FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger only maps a pickup ZIP to its zone; run with owner rights so it works for any inserting user.
ALTER FUNCTION public.assign_trip_dispatch_zone() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.assign_trip_dispatch_zone() FROM PUBLIC, anon, authenticated;