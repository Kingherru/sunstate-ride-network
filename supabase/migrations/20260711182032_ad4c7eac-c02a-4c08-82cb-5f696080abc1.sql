ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS dropoff_zip text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_profiles TO authenticated;
GRANT ALL ON public.member_profiles TO service_role;