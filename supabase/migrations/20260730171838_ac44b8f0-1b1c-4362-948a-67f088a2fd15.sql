CREATE TABLE public.trip_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  autosaved boolean NOT NULL DEFAULT true,
  submitted_trip_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_drafts TO authenticated;
GRANT ALL ON public.trip_drafts TO service_role;

ALTER TABLE public.trip_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own trip drafts"
ON public.trip_drafts FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_trip_drafts_user_updated ON public.trip_drafts (user_id, updated_at DESC);

CREATE TRIGGER update_trip_drafts_updated_at
BEFORE UPDATE ON public.trip_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();