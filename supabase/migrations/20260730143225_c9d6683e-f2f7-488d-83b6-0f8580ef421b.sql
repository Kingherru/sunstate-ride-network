ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS scheduled_start_time time without time zone;

DROP POLICY IF EXISTS "Referral target can view trips" ON public.trips;
CREATE POLICY "Referral target can view trips"
ON public.trips
FOR SELECT
TO authenticated
USING (auth.uid() = referral_target_id);