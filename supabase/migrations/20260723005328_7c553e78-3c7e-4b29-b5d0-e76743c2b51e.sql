
-- Restrict course_questions: prevent enrolled users from reading answer key columns
REVOKE SELECT ON public.course_questions FROM authenticated;
REVOKE SELECT ON public.course_questions FROM anon;
GRANT SELECT (id, course_id, ord, prompt, choices, created_at) ON public.course_questions TO authenticated;

-- Restrict dispatch_zones and dispatch_zone_zips to authenticated users
DROP POLICY IF EXISTS "zones readable by all" ON public.dispatch_zones;
CREATE POLICY "zones readable by authenticated"
  ON public.dispatch_zones
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "zone_zips readable by all" ON public.dispatch_zone_zips;
CREATE POLICY "zone_zips readable by authenticated"
  ON public.dispatch_zone_zips
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.dispatch_zones FROM anon;
REVOKE SELECT ON public.dispatch_zone_zips FROM anon;
