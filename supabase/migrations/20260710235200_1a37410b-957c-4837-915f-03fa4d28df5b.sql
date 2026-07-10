
CREATE TABLE public.tab_view_marks (
  user_id uuid NOT NULL,
  tab_key text NOT NULL,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tab_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tab_view_marks TO authenticated;
GRANT ALL ON public.tab_view_marks TO service_role;

ALTER TABLE public.tab_view_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tab marks"
  ON public.tab_view_marks
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Realtime for badge updates
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
