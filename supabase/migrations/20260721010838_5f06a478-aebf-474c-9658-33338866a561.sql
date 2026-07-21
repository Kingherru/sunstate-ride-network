
-- 1) provider_applications INSERT: force safe defaults for status/compliance_status
DROP POLICY IF EXISTS "Anyone can apply to be a provider" ON public.provider_applications;
CREATE POLICY "Anyone can apply to be a provider"
  ON public.provider_applications
  FOR INSERT
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 3 AND 320
    AND (status IS NULL OR status = 'new')
    AND (compliance_status IS NULL OR compliance_status = 'approved')
  );

-- 2) ride_requests INSERT: prevent pre-assignment/pre-payment/pre-quote manipulation
DROP POLICY IF EXISTS "Anyone can submit a ride request" ON public.ride_requests;
CREATE POLICY "Anyone can submit a ride request"
  ON public.ride_requests
  FOR INSERT
  WITH CHECK (
    ((requester_user_id IS NULL) OR (requester_user_id = auth.uid()))
    AND pickup_address IS NOT NULL AND length(pickup_address) BETWEEN 3 AND 500
    AND dropoff_address IS NOT NULL AND length(dropoff_address) BETWEEN 3 AND 500
    AND pickup_date IS NOT NULL
    AND assigned_provider_id IS NULL
    AND (status IS NULL OR status = 'new')
    AND (payment_status IS NULL OR payment_status = 'unpaid')
    AND estimated_cost_cents IS NULL
    AND (black_tie_quote_status IS NULL OR black_tie_quote_status = 'awaiting_quote')
  );

-- 3) course_questions: hide correct_index and explanation from enrolled learners.
-- Use column-level GRANTs so RLS SELECT policy only exposes safe columns.
-- Admins already have full access via SECURITY DEFINER functions and the "Admins manage questions" policy on ALL commands,
-- but column-grant revokes apply to authenticated role uniformly, so we route grading through service role.
REVOKE SELECT ON public.course_questions FROM authenticated;
GRANT SELECT (id, course_id, ord, prompt, choices, created_at) ON public.course_questions TO authenticated;
-- service_role retains full access for grading via supabaseAdmin
GRANT ALL ON public.course_questions TO service_role;
