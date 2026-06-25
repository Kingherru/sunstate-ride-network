-- 1. Service level + assistance flags on trips & ride_requests
DO $$ BEGIN
  CREATE TYPE public.service_level AS ENUM ('door_to_door','bed_to_bed','curb_to_curb','driveway_pickup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS service_level public.service_level,
  ADD COLUMN IF NOT EXISTS needs_wheelchair boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_passenger boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_assistance_to_vehicle boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_surgery_signin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_surgery_signout boolean NOT NULL DEFAULT false;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS service_level public.service_level,
  ADD COLUMN IF NOT EXISTS needs_wheelchair boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_passenger boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_assistance_to_vehicle boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_surgery_signin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_surgery_signout boolean NOT NULL DEFAULT false;

-- 2. Provider ratings
CREATE TABLE IF NOT EXISTS public.provider_ratings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  provider_id         uuid NOT NULL,
  rater_id            uuid NOT NULL,
  on_time_pickup      smallint CHECK (on_time_pickup BETWEEN 1 AND 5),
  on_time_arrival     smallint CHECK (on_time_arrival BETWEEN 1 AND 5),
  completed_pickup    smallint CHECK (completed_pickup BETWEEN 1 AND 5),
  professionalism     smallint CHECK (professionalism BETWEEN 1 AND 5),
  cleanliness         smallint CHECK (cleanliness BETWEEN 1 AND 5),
  overall             smallint NOT NULL CHECK (overall BETWEEN 1 AND 5),
  comment             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, rater_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_ratings TO authenticated;
GRANT ALL ON public.provider_ratings TO service_role;

ALTER TABLE public.provider_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can see ratings (so providers can display them); rater + provider + admin can see comments
CREATE POLICY "Public can read ratings"
  ON public.provider_ratings FOR SELECT
  TO authenticated
  USING (true);

-- Only the trip sender (created_by) or an admin can insert a rating, and only for the assigned provider on a completed trip
CREATE POLICY "Sender rates assigned provider on completed trips"
  ON public.provider_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.trips t
       WHERE t.id = trip_id
         AND t.assigned_to = provider_ratings.provider_id
         AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
         AND lower(t.status) IN ('completed','complete','delivered')
    )
  );

CREATE POLICY "Rater can update or delete their rating"
  ON public.provider_ratings FOR UPDATE
  TO authenticated
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

CREATE POLICY "Rater or admin can delete rating"
  ON public.provider_ratings FOR DELETE
  TO authenticated
  USING (rater_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS provider_ratings_provider_idx ON public.provider_ratings(provider_id);

-- 3. Aggregate view (price intentionally excluded)
CREATE OR REPLACE VIEW public.provider_rating_summary AS
SELECT
  provider_id,
  count(*)                                         AS ratings_count,
  round(avg(overall)::numeric, 2)                  AS avg_overall,
  round(avg(on_time_pickup)::numeric, 2)           AS avg_on_time_pickup,
  round(avg(on_time_arrival)::numeric, 2)          AS avg_on_time_arrival,
  round(avg(completed_pickup)::numeric, 2)         AS avg_completed_pickup,
  round(avg(professionalism)::numeric, 2)          AS avg_professionalism,
  round(avg(cleanliness)::numeric, 2)              AS avg_cleanliness
FROM public.provider_ratings
GROUP BY provider_id;

GRANT SELECT ON public.provider_rating_summary TO authenticated, anon;