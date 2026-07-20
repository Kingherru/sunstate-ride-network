
-- 1) provider_ratings: prevent changing provider_id/trip_id/rater_id on update
CREATE OR REPLACE FUNCTION public.provider_ratings_prevent_key_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.rater_id IS DISTINCT FROM OLD.rater_id
     OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
     OR NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'Cannot change rater_id, provider_id, or trip_id on an existing rating';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_ratings_prevent_key_change ON public.provider_ratings;
CREATE TRIGGER trg_provider_ratings_prevent_key_change
BEFORE UPDATE ON public.provider_ratings
FOR EACH ROW EXECUTE FUNCTION public.provider_ratings_prevent_key_change();

REVOKE EXECUTE ON FUNCTION public.provider_ratings_prevent_key_change() FROM PUBLIC, anon, authenticated;

-- Also tighten the rater UPDATE policy to re-check the completed-trip relationship,
-- mirroring the INSERT policy so a spoofed row cannot be updated to an unrelated trip.
DROP POLICY IF EXISTS "Rater can update or delete their rating" ON public.provider_ratings;
CREATE POLICY "Rater can update their rating"
ON public.provider_ratings
FOR UPDATE
TO authenticated
USING (
  rater_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = provider_ratings.trip_id
      AND t.assigned_to = provider_ratings.provider_id
      AND t.created_by = auth.uid()
      AND lower(t.status) = ANY (ARRAY['completed','complete','delivered'])
  )
)
WITH CHECK (
  rater_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = provider_ratings.trip_id
      AND t.assigned_to = provider_ratings.provider_id
      AND t.created_by = auth.uid()
      AND lower(t.status) = ANY (ARRAY['completed','complete','delivered'])
  )
);

-- 2) trips: scope dispatcher UPDATE policy to non-terminal, active workflow statuses.
-- Admins retain full control via the "admins manage trips" ALL policy.
DROP POLICY IF EXISTS "dispatchers update trips" ON public.trips;
CREATE POLICY "dispatchers update active trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['dispatcher'::app_role, 'app_manager'::app_role])
  AND lower(coalesce(status, '')) NOT IN ('completed','complete','delivered','canceled','cancelled','paid','refunded')
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['dispatcher'::app_role, 'app_manager'::app_role])
  AND lower(coalesce(status, '')) NOT IN ('canceled','cancelled','refunded')
);
