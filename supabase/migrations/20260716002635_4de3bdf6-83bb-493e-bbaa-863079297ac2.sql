
-- Messages: sender or staff can delete
DROP POLICY IF EXISTS "messages_delete_sender_or_staff" ON public.messages;
CREATE POLICY "messages_delete_sender_or_staff" ON public.messages
  FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.is_ops_staff(auth.uid())
  );

-- Thread participants: user can remove themselves; staff can remove anyone
DROP POLICY IF EXISTS "participants_delete_self_or_staff" ON public.thread_participants;
CREATE POLICY "participants_delete_self_or_staff" ON public.thread_participants
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ops_staff(auth.uid())
  );

-- Message threads: only staff can delete an entire conversation
DROP POLICY IF EXISTS "threads_delete_staff" ON public.message_threads;
CREATE POLICY "threads_delete_staff" ON public.message_threads
  FOR DELETE TO authenticated
  USING (public.is_ops_staff(auth.uid()));
