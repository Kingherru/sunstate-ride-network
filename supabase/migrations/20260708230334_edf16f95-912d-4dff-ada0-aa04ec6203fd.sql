-- Internal messaging system
CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.thread_participants (
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX thread_participants_user_idx ON public.thread_participants(user_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_idx ON public.messages(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.message_threads TO service_role;
GRANT ALL ON public.thread_participants TO service_role;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: is user a participant in thread?
CREATE OR REPLACE FUNCTION public.is_thread_participant(_thread_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.thread_participants WHERE thread_id = _thread_id AND user_id = _user_id);
$$;

-- Permission rule: can user A message user B?
CREATE OR REPLACE FUNCTION public.can_message(_a uuid, _b uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a_staff boolean;
  b_staff boolean;
  a_provider boolean;
  b_provider boolean;
  a_paid boolean;
  b_paid boolean;
  a_portal text;
  b_portal text;
  rel_exists boolean;
BEGIN
  IF _a IS NULL OR _b IS NULL OR _a = _b THEN RETURN false; END IF;

  a_staff := public.is_ops_staff(_a);
  b_staff := public.is_ops_staff(_b);

  -- Any staff can message any other user
  IF a_staff OR b_staff THEN RETURN true; END IF;

  -- Resolve portal
  SELECT lower(coalesce(raw_user_meta_data->>'portal','provider')) INTO a_portal FROM auth.users WHERE id = _a;
  SELECT lower(coalesce(raw_user_meta_data->>'portal','provider')) INTO b_portal FROM auth.users WHERE id = _b;

  a_provider := coalesce(a_portal,'') IN ('provider','facility') OR public.is_approved_provider(_a);
  b_provider := coalesce(b_portal,'') IN ('provider','facility') OR public.is_approved_provider(_b);

  SELECT (membership_status='active' AND membership_tier='paid') INTO a_paid FROM public.member_profiles WHERE user_id = _a;
  SELECT (membership_status='active' AND membership_tier='paid') INTO b_paid FROM public.member_profiles WHERE user_id = _b;

  -- Provider ↔ Provider: both subscribed
  IF a_provider AND b_provider THEN
    RETURN coalesce(a_paid,false) AND coalesce(b_paid,false);
  END IF;

  -- Patient ↔ Provider: existing relationship required
  IF (a_portal = 'patient' AND b_provider) OR (b_portal = 'patient' AND a_provider) THEN
    SELECT EXISTS(
      SELECT 1 FROM public.trips t
      WHERE ((t.requester_user_id = _a AND (t.assigned_to = _b OR t.assigned_provider_id = _b))
          OR (t.requester_user_id = _b AND (t.assigned_to = _a OR t.assigned_provider_id = _a)))
    ) INTO rel_exists;
    IF rel_exists THEN RETURN true; END IF;
    SELECT EXISTS(
      SELECT 1 FROM public.ride_requests r
      WHERE ((r.requester_user_id = _a AND r.assigned_provider_id = _b)
          OR (r.requester_user_id = _b AND r.assigned_provider_id = _a))
    ) INTO rel_exists;
    RETURN coalesce(rel_exists,false);
  END IF;

  RETURN false;
END $$;

-- RLS policies
CREATE POLICY "threads_select_participant" ON public.message_threads
  FOR SELECT TO authenticated
  USING (public.is_thread_participant(id, auth.uid()));

CREATE POLICY "threads_insert_self" ON public.message_threads
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "threads_update_participant" ON public.message_threads
  FOR UPDATE TO authenticated
  USING (public.is_thread_participant(id, auth.uid()));

CREATE POLICY "participants_select_own_threads" ON public.thread_participants
  FOR SELECT TO authenticated
  USING (public.is_thread_participant(thread_id, auth.uid()));

CREATE POLICY "participants_insert_self_thread" ON public.thread_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    -- allow inserting yourself or other participants during initial thread creation by created_by
    EXISTS(SELECT 1 FROM public.message_threads t WHERE t.id = thread_id AND t.created_by = auth.uid())
  );

CREATE POLICY "participants_update_self" ON public.thread_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_thread_participant(thread_id, auth.uid()));

CREATE POLICY "messages_insert_participant" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_thread_participant(thread_id, auth.uid())
  );

-- Bump last_message_at
CREATE OR REPLACE FUNCTION public.bump_thread_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.message_threads SET last_message_at = NEW.created_at WHERE id = NEW.thread_id;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_bump_thread AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_thread_last_message();

-- Start-or-get 1:1 thread with permission check
CREATE OR REPLACE FUNCTION public.start_direct_thread(_recipient uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_thread uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_message(v_uid, _recipient) THEN
    RAISE EXCEPTION 'You do not have permission to message this user.';
  END IF;

  SELECT tp1.thread_id INTO v_thread
    FROM public.thread_participants tp1
    JOIN public.thread_participants tp2 ON tp1.thread_id = tp2.thread_id
   WHERE tp1.user_id = v_uid AND tp2.user_id = _recipient
   GROUP BY tp1.thread_id
   HAVING count(*) FILTER (WHERE tp1.user_id IN (v_uid, _recipient)) = 1
   LIMIT 1;

  IF v_thread IS NOT NULL THEN
    -- Ensure it is a 1:1 thread (exactly 2 participants)
    IF (SELECT count(*) FROM public.thread_participants WHERE thread_id = v_thread) = 2 THEN
      RETURN v_thread;
    END IF;
  END IF;

  INSERT INTO public.message_threads (created_by) VALUES (v_uid) RETURNING id INTO v_thread;
  INSERT INTO public.thread_participants (thread_id, user_id) VALUES (v_thread, v_uid), (v_thread, _recipient);
  RETURN v_thread;
END $$;
