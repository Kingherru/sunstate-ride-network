
-- 1. Ride request revisions (true audit history)
CREATE TABLE public.ride_request_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_request_id UUID NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role TEXT,
  changed_by_email TEXT,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ride_request_id, revision_number)
);
GRANT SELECT ON public.ride_request_revisions TO authenticated;
GRANT ALL ON public.ride_request_revisions TO service_role;
ALTER TABLE public.ride_request_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters and assigned providers can view their revisions"
ON public.ride_request_revisions FOR SELECT TO authenticated
USING (
  public.is_ops_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.ride_requests r
    WHERE r.id = ride_request_revisions.ride_request_id
      AND (r.requester_user_id = auth.uid() OR r.assigned_provider_id = auth.uid())
  )
);

CREATE INDEX idx_ride_request_revisions_request ON public.ride_request_revisions(ride_request_id, revision_number);

-- Trigger to snapshot ride_requests on insert + on update
CREATE OR REPLACE FUNCTION public.snapshot_ride_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_email text;
  v_next_rev int;
  v_summary text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF to_jsonb(NEW) - 'updated_at' - 'last_updated_at' = to_jsonb(OLD) - 'updated_at' - 'last_updated_at' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO v_next_rev
  FROM public.ride_request_revisions WHERE ride_request_id = NEW.id;

  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
    IF public.is_ops_staff(v_actor) THEN v_role := 'staff';
    ELSIF NEW.assigned_provider_id = v_actor THEN v_role := 'provider';
    ELSIF NEW.requester_user_id = v_actor THEN v_role := 'requester';
    ELSE v_role := 'user'; END IF;
  ELSE v_role := 'system'; END IF;

  v_summary := CASE WHEN TG_OP = 'INSERT' THEN 'Initial submission' ELSE 'Update' END;

  INSERT INTO public.ride_request_revisions
    (ride_request_id, revision_number, snapshot, changed_by, changed_by_role, changed_by_email, change_summary)
  VALUES (NEW.id, v_next_rev, to_jsonb(NEW), v_actor, v_role, v_email, v_summary);

  RETURN NEW;
END $$;

CREATE TRIGGER trg_ride_request_snapshot
AFTER INSERT OR UPDATE ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.snapshot_ride_request();

-- 2. Assigned vehicle on ride_requests
ALTER TABLE public.ride_requests
  ADD COLUMN assigned_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- 3. Manual complete/uncomplete on trips
ALTER TABLE public.trips
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN completion_source TEXT;

-- 4. Feedback inbox
CREATE TABLE public.feedback_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submitter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitter_email TEXT,
  submitter_display_id TEXT,
  portal TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.feedback_submissions TO authenticated;
GRANT ALL ON public.feedback_submissions TO service_role;
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create their own feedback"
ON public.feedback_submissions FOR INSERT TO authenticated
WITH CHECK (submitter_user_id = auth.uid());

CREATE POLICY "Users read their own feedback"
ON public.feedback_submissions FOR SELECT TO authenticated
USING (submitter_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.is_ops_staff(auth.uid()));

CREATE POLICY "Admins update feedback"
ON public.feedback_submissions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_feedback_updated_at
BEFORE UPDATE ON public.feedback_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify admins in-app on new feedback
CREATE OR REPLACE FUNCTION public.notify_admins_on_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'feedback_submitted',
            'New feedback: ' || NEW.subject,
            COALESCE(NEW.submitter_email, 'A user') || ' (' || NEW.portal || ') submitted ' || NEW.category || ' feedback.',
            '/admin?tab=feedback');
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_feedback_notify_admins
AFTER INSERT ON public.feedback_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_feedback();

-- 5. Membership opportunity email dedupe log
CREATE TABLE public.membership_opportunity_email_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_period_start DATE NOT NULL,
  trip_count INTEGER NOT NULL DEFAULT 0,
  estimated_revenue_cents INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_user_id, batch_period_start)
);
GRANT SELECT ON public.membership_opportunity_email_log TO authenticated;
GRANT ALL ON public.membership_opportunity_email_log TO service_role;
ALTER TABLE public.membership_opportunity_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers see own opportunity log"
ON public.membership_opportunity_email_log FOR SELECT TO authenticated
USING (provider_user_id = auth.uid() OR public.is_ops_staff(auth.uid()));
