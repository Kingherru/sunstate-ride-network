-- 1) Trip referral state columns
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS referral_target_id uuid,
  ADD COLUMN IF NOT EXISTS referral_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS referral_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_decline_reason text;

DO $$ BEGIN
  ALTER TABLE public.trips
    ADD CONSTRAINT trips_referral_status_check
    CHECK (referral_status IN ('none','pending','accepted','declined'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS trips_referral_target_idx
  ON public.trips (referral_target_id, referral_status);

-- Backfill any nulls introduced on existing rows
UPDATE public.trips SET referral_status = 'none' WHERE referral_status IS NULL;

-- 2) Referral history table (audit log surfaced in every portal)
CREATE TABLE IF NOT EXISTS public.trip_referral_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('sent','accepted','declined','canceled')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.trip_referral_history TO authenticated;
GRANT ALL ON public.trip_referral_history TO service_role;

ALTER TABLE public.trip_referral_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referral history visible to sender, recipient, or staff"
  ON public.trip_referral_history;
CREATE POLICY "Referral history visible to sender, recipient, or staff"
  ON public.trip_referral_history FOR SELECT
  TO authenticated
  USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR public.is_ops_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_referral_history.trip_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR t.referral_target_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Sender can insert their referral history"
  ON public.trip_referral_history;
CREATE POLICY "Sender can insert their referral history"
  ON public.trip_referral_history FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS trip_referral_history_trip_idx
  ON public.trip_referral_history (trip_id, created_at DESC);

-- 3) Realtime so every portal sees referral updates instantly
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_referral_history;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;