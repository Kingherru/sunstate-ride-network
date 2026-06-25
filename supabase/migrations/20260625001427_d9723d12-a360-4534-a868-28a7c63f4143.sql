-- Revoke EXECUTE on admin-only SECURITY DEFINER functions from signed-in users
REVOKE EXECUTE ON FUNCTION public.admin_grant_free_membership(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trips_admin_metadata() FROM PUBLIC, anon, authenticated;

-- Tighten permissive INSERT policies
DROP POLICY IF EXISTS "Anyone can submit a ride request" ON public.ride_requests;
CREATE POLICY "Anyone can submit a ride request"
  ON public.ride_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (requester_user_id IS NULL OR requester_user_id = auth.uid())
    AND pickup_address IS NOT NULL AND length(pickup_address) BETWEEN 3 AND 500
    AND dropoff_address IS NOT NULL AND length(dropoff_address) BETWEEN 3 AND 500
    AND pickup_date IS NOT NULL
  );

DROP POLICY IF EXISTS "Anyone can send a contact message" ON public.contact_messages;
CREATE POLICY "Anyone can send a contact message"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL AND length(email) BETWEEN 3 AND 320
    AND message IS NOT NULL AND length(message) BETWEEN 1 AND 5000
  );

DROP POLICY IF EXISTS "Anyone can apply to be a provider" ON public.provider_applications;
CREATE POLICY "Anyone can apply to be a provider"
  ON public.provider_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL AND length(email) BETWEEN 3 AND 320
  );