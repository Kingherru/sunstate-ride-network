ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS dispatch_zone_id uuid REFERENCES public.dispatch_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_member_profiles_dispatch_zone ON public.member_profiles(dispatch_zone_id);

-- Backfill dispatch_zone_id from postal_code where a mapping exists
UPDATE public.member_profiles mp
SET dispatch_zone_id = dz.zone_id
FROM public.dispatch_zone_zips dz
WHERE mp.dispatch_zone_id IS NULL
  AND mp.postal_code IS NOT NULL
  AND dz.zip = mp.postal_code;
