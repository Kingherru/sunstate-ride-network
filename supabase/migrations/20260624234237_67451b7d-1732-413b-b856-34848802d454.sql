
-- 1. Extend ride_requests
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS provider_notes text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_amount_cents integer,
  ADD COLUMN IF NOT EXISTS assigned_provider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurrence_exceptions date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS last_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ride_requests_assigned_provider_id_idx
  ON public.ride_requests (assigned_provider_id);

-- 2. Notifications table (in-app inbox)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  ride_request_id uuid REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users mark own notifications" ON public.notifications;
CREATE POLICY "Users mark own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all notifications" ON public.notifications;
CREATE POLICY "Admins view all notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read_at, created_at DESC);

-- 3. Email queue (drained by a worker once email domain is configured)
CREATE TABLE IF NOT EXISTS public.notification_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  ride_request_id uuid REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_email_queue TO authenticated;
GRANT ALL ON public.notification_email_queue TO service_role;

ALTER TABLE public.notification_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view email queue" ON public.notification_email_queue;
CREATE POLICY "Admins view email queue"
  ON public.notification_email_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Trigger: emit notification + queue email on ride_request status/assignment changes
CREATE OR REPLACE FUNCTION public.notify_ride_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_title text;
  v_body text;
  v_type text;
  v_link text;
BEGIN
  NEW.last_updated_at := now();

  IF NEW.requester_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_link := '/requests/' || NEW.id::text;
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.requester_user_id;

  -- Provider assigned
  IF TG_OP = 'UPDATE'
     AND NEW.assigned_provider_id IS DISTINCT FROM OLD.assigned_provider_id
     AND NEW.assigned_provider_id IS NOT NULL THEN
    v_type := 'provider_assigned';
    v_title := 'A provider was assigned to your ride';
    v_body := 'Your ride request on ' || NEW.pickup_date || ' at ' || NEW.pickup_time || ' has been assigned to a provider.';

    INSERT INTO public.notifications (user_id, type, title, body, link, ride_request_id)
    VALUES (NEW.requester_user_id, v_type, v_title, v_body, v_link, NEW.id);

    IF v_email IS NOT NULL THEN
      INSERT INTO public.notification_email_queue (recipient_email, subject, body, ride_request_id)
      VALUES (v_email, v_title, v_body || E'\n\nView details: ' || v_link, NEW.id);
    END IF;
  END IF;

  -- Status changed to canceled
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND lower(NEW.status) IN ('canceled', 'cancelled') THEN
    v_type := 'canceled';
    v_title := 'Your ride request was canceled';
    v_body := 'Your ride request on ' || NEW.pickup_date || ' at ' || NEW.pickup_time || ' was canceled.';

    INSERT INTO public.notifications (user_id, type, title, body, link, ride_request_id)
    VALUES (NEW.requester_user_id, v_type, v_title, v_body, v_link, NEW.id);

    IF v_email IS NOT NULL THEN
      INSERT INTO public.notification_email_queue (recipient_email, subject, body, ride_request_id)
      VALUES (v_email, v_title, v_body || E'\n\nView details: ' || v_link, NEW.id);
    END IF;
  END IF;

  -- Rescheduled
  IF TG_OP = 'UPDATE'
     AND (NEW.pickup_date IS DISTINCT FROM OLD.pickup_date
          OR NEW.pickup_time IS DISTINCT FROM OLD.pickup_time
          OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address) THEN
    v_type := 'rescheduled';
    v_title := 'Your ride request was updated';
    v_body := 'Your ride is now scheduled for ' || NEW.pickup_date || ' at ' || NEW.pickup_time || ' from ' || NEW.pickup_address || '.';

    INSERT INTO public.notifications (user_id, type, title, body, link, ride_request_id)
    VALUES (NEW.requester_user_id, v_type, v_title, v_body, v_link, NEW.id);

    IF v_email IS NOT NULL THEN
      INSERT INTO public.notification_email_queue (recipient_email, subject, body, ride_request_id)
      VALUES (v_email, v_title, v_body || E'\n\nView details: ' || v_link, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ride_request_event ON public.ride_requests;
CREATE TRIGGER trg_notify_ride_request_event
  BEFORE UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_ride_request_event();
