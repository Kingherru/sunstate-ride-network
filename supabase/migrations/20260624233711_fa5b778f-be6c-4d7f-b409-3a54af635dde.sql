
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE INDEX IF NOT EXISTS ride_requests_requester_user_id_idx
  ON public.ride_requests (requester_user_id);

-- Requesters can view their own ride requests
DROP POLICY IF EXISTS "Requesters can view own ride requests" ON public.ride_requests;
CREATE POLICY "Requesters can view own ride requests"
  ON public.ride_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_user_id);

-- Requesters can update (cancel / edit) their own ride requests, but cannot reassign ownership
DROP POLICY IF EXISTS "Requesters can update own ride requests" ON public.ride_requests;
CREATE POLICY "Requesters can update own ride requests"
  ON public.ride_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_user_id)
  WITH CHECK (auth.uid() = requester_user_id);
