
-- 1) Extend message_threads with routing metadata
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.dispatch_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS feedback_id uuid REFERENCES public.feedback_submissions(id) ON DELETE SET NULL;

ALTER TABLE public.message_threads
  DROP CONSTRAINT IF EXISTS message_threads_kind_check;
ALTER TABLE public.message_threads
  ADD CONSTRAINT message_threads_kind_check
  CHECK (kind IN ('direct','dispatch','zone_manager','feedback_admin'));

CREATE INDEX IF NOT EXISTS idx_message_threads_kind_zone ON public.message_threads(kind, zone_id);

-- 2) Helper: get admin user_ids (for fallbacks)
CREATE OR REPLACE FUNCTION public.admin_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT user_id FROM public.user_roles
   WHERE role IN ('admin','app_manager')
$$;

-- 3) Open (or reuse) a dispatch team thread for the current user.
--    Routes to dispatchers/admins; admins are always kept in the loop for auditability.
CREATE OR REPLACE FUNCTION public.open_dispatch_thread(_zone_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_thread uuid;
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT t.id INTO v_thread
    FROM public.message_threads t
    JOIN public.thread_participants tp ON tp.thread_id = t.id AND tp.user_id = v_uid
   WHERE t.kind = 'dispatch'
     AND (t.zone_id IS NOT DISTINCT FROM _zone_id)
   ORDER BY t.created_at DESC
   LIMIT 1;

  IF v_thread IS NOT NULL THEN RETURN v_thread; END IF;

  INSERT INTO public.message_threads (created_by, kind, zone_id, subject)
    VALUES (v_uid, 'dispatch', _zone_id, 'Dispatch')
    RETURNING id INTO v_thread;

  INSERT INTO public.thread_participants (thread_id, user_id) VALUES (v_thread, v_uid);

  -- Add current dispatchers + admins as counterparts. Admins guarantee coverage
  -- when no dispatcher is assigned yet.
  FOR r IN
    SELECT DISTINCT user_id FROM public.user_roles
     WHERE role IN ('dispatcher','admin','app_manager')
  LOOP
    IF r.user_id <> v_uid THEN
      INSERT INTO public.thread_participants (thread_id, user_id)
        VALUES (v_thread, r.user_id)
        ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_thread;
END $$;

-- 4) Open (or reuse) a zone-manager thread. If no manager is assigned yet, admins
--    receive the messages. When a zone manager is later assigned (trigger below),
--    they are automatically added to any existing zone thread.
CREATE OR REPLACE FUNCTION public.open_zone_manager_thread(_zone_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_thread uuid;
  v_added int := 0;
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _zone_id IS NULL THEN RAISE EXCEPTION 'A zone is required'; END IF;

  SELECT t.id INTO v_thread
    FROM public.message_threads t
    JOIN public.thread_participants tp ON tp.thread_id = t.id AND tp.user_id = v_uid
   WHERE t.kind = 'zone_manager' AND t.zone_id = _zone_id
   ORDER BY t.created_at DESC
   LIMIT 1;

  IF v_thread IS NOT NULL THEN RETURN v_thread; END IF;

  INSERT INTO public.message_threads (created_by, kind, zone_id, subject)
    VALUES (v_uid, 'zone_manager', _zone_id,
            'Zone Manager · ' || COALESCE((SELECT name FROM public.dispatch_zones WHERE id = _zone_id), 'zone'))
    RETURNING id INTO v_thread;

  INSERT INTO public.thread_participants (thread_id, user_id) VALUES (v_thread, v_uid);

  FOR r IN
    SELECT DISTINCT user_id FROM public.zone_manager_assignments WHERE zone_id = _zone_id
  LOOP
    IF r.user_id <> v_uid THEN
      INSERT INTO public.thread_participants (thread_id, user_id)
        VALUES (v_thread, r.user_id) ON CONFLICT DO NOTHING;
      v_added := v_added + 1;
    END IF;
  END LOOP;

  -- Fallback: no manager assigned → route to admins for now.
  IF v_added = 0 THEN
    FOR r IN SELECT public.admin_user_ids() AS user_id LOOP
      IF r.user_id <> v_uid THEN
        INSERT INTO public.thread_participants (thread_id, user_id)
          VALUES (v_thread, r.user_id) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_thread;
END $$;

-- 5) Submit a feedback message to the admin. Creates the feedback_submissions row
--    AND opens a thread so the user has a live conversation with admins.
CREATE OR REPLACE FUNCTION public.submit_feedback_message(_subject text, _body text, _category text DEFAULT 'general')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_thread uuid;
  v_feedback uuid;
  v_email text;
  v_display text;
  v_portal text;
  r record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(btrim(_subject), '') = '' THEN RAISE EXCEPTION 'Subject required'; END IF;
  IF coalesce(btrim(_body), '') = '' THEN RAISE EXCEPTION 'Message required'; END IF;

  SELECT email, lower(coalesce(raw_user_meta_data->>'portal','provider'))
    INTO v_email, v_portal FROM auth.users WHERE id = v_uid;
  SELECT display_id INTO v_display FROM public.member_profiles WHERE user_id = v_uid;

  INSERT INTO public.feedback_submissions
    (submitter_user_id, submitter_email, submitter_display_id, portal, category, subject, message, status)
    VALUES (v_uid, v_email, v_display, v_portal, coalesce(_category,'general'), _subject, _body, 'open')
    RETURNING id INTO v_feedback;

  INSERT INTO public.message_threads (created_by, kind, subject, feedback_id)
    VALUES (v_uid, 'feedback_admin', 'Feedback: ' || _subject, v_feedback)
    RETURNING id INTO v_thread;

  INSERT INTO public.thread_participants (thread_id, user_id) VALUES (v_thread, v_uid);

  FOR r IN SELECT public.admin_user_ids() AS user_id LOOP
    IF r.user_id <> v_uid THEN
      INSERT INTO public.thread_participants (thread_id, user_id)
        VALUES (v_thread, r.user_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO public.messages (thread_id, sender_id, body)
    VALUES (v_thread, v_uid, _body);

  RETURN v_thread;
END $$;

-- 6) Auto-add newly assigned zone managers to any existing zone_manager threads
CREATE OR REPLACE FUNCTION public.on_zone_manager_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.message_threads
     WHERE kind = 'zone_manager' AND zone_id = NEW.zone_id
  LOOP
    INSERT INTO public.thread_participants (thread_id, user_id)
      VALUES (r.id, NEW.user_id)
      ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zma_populate_zone_threads ON public.zone_manager_assignments;
CREATE TRIGGER zma_populate_zone_threads
  AFTER INSERT ON public.zone_manager_assignments
  FOR EACH ROW EXECUTE FUNCTION public.on_zone_manager_assigned();

-- 7) Auto-add newly-appointed dispatchers to any existing dispatch threads
CREATE OR REPLACE FUNCTION public.on_dispatch_role_granted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.role NOT IN ('dispatcher','admin','app_manager') THEN RETURN NEW; END IF;
  FOR r IN SELECT id FROM public.message_threads WHERE kind = 'dispatch' LOOP
    INSERT INTO public.thread_participants (thread_id, user_id)
      VALUES (r.id, NEW.user_id)
      ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_roles_populate_dispatch_threads ON public.user_roles;
CREATE TRIGGER user_roles_populate_dispatch_threads
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.on_dispatch_role_granted();

-- 8) New-message notifications for every other participant
CREATE OR REPLACE FUNCTION public.notify_thread_participants_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_kind text;
  v_link text := '/dashboard?tab=messages';
  r record;
BEGIN
  SELECT kind INTO v_kind FROM public.message_threads WHERE id = NEW.thread_id;
  SELECT COALESCE(NULLIF(btrim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), ''), company_name, display_id, 'Member')
    INTO v_sender_name FROM public.member_profiles WHERE user_id = NEW.sender_id;

  FOR r IN
    SELECT user_id FROM public.thread_participants
     WHERE thread_id = NEW.thread_id AND user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      r.user_id,
      'new_message',
      'New message from ' || COALESCE(v_sender_name, 'a member'),
      LEFT(NEW.body, 240),
      v_link
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS messages_notify_participants ON public.messages;
CREATE TRIGGER messages_notify_participants
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_thread_participants_on_message();

-- 9) Enable realtime for messages, threads, participants, and notifications
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['messages','message_threads','thread_participants','notifications']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_threads REPLICA IDENTITY FULL;
ALTER TABLE public.thread_participants REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
