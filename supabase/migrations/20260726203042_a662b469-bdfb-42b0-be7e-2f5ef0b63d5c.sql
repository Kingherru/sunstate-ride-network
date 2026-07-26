-- 1) course_questions: hide answer key from students at the column level.
REVOKE SELECT ON public.course_questions FROM authenticated, anon;
GRANT SELECT (id, course_id, ord, prompt, choices, created_at)
  ON public.course_questions TO authenticated;
-- Admins/dispatchers manage via server functions using the service role client
-- (see src/lib/courses.functions.ts); grading also uses the service role.
GRANT ALL ON public.course_questions TO service_role;

-- 2) Driver financial policies: scope to authenticated instead of PUBLIC.
ALTER POLICY "Drivers can view their own adjustments"
  ON public.driver_earning_adjustments TO authenticated;
ALTER POLICY "Owners manage their driver adjustments"
  ON public.driver_earning_adjustments TO authenticated;

ALTER POLICY "Drivers can view their own payments"
  ON public.driver_payments TO authenticated;
ALTER POLICY "Owners manage their driver payments"
  ON public.driver_payments TO authenticated;

ALTER POLICY "Drivers can view their own earnings reports"
  ON public.driver_earnings_reports TO authenticated;
ALTER POLICY "Owners manage their earnings reports"
  ON public.driver_earnings_reports TO authenticated;

-- 3) SECURITY DEFINER function callable by PUBLIC: it's a trigger helper,
-- no one should invoke it directly.
REVOKE EXECUTE ON FUNCTION public.assign_member_dispatch_zone() FROM PUBLIC, anon, authenticated;