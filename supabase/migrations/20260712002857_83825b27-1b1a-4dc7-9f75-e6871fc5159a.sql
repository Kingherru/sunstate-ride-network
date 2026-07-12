
DROP VIEW IF EXISTS public.provider_rating_summary;

ALTER TABLE public.provider_ratings ALTER COLUMN overall           TYPE numeric(2,1) USING overall::numeric(2,1);
ALTER TABLE public.provider_ratings ALTER COLUMN on_time_pickup    TYPE numeric(2,1) USING on_time_pickup::numeric(2,1);
ALTER TABLE public.provider_ratings ALTER COLUMN on_time_arrival   TYPE numeric(2,1) USING on_time_arrival::numeric(2,1);
ALTER TABLE public.provider_ratings ALTER COLUMN completed_pickup  TYPE numeric(2,1) USING completed_pickup::numeric(2,1);
ALTER TABLE public.provider_ratings ALTER COLUMN professionalism   TYPE numeric(2,1) USING professionalism::numeric(2,1);
ALTER TABLE public.provider_ratings ALTER COLUMN cleanliness       TYPE numeric(2,1) USING cleanliness::numeric(2,1);

CREATE VIEW public.provider_rating_summary AS
SELECT provider_id,
    count(*) AS ratings_count,
    round(avg(overall), 2) AS avg_overall,
    round(avg(on_time_pickup), 2) AS avg_on_time_pickup,
    round(avg(on_time_arrival), 2) AS avg_on_time_arrival,
    round(avg(completed_pickup), 2) AS avg_completed_pickup,
    round(avg(professionalism), 2) AS avg_professionalism,
    round(avg(cleanliness), 2) AS avg_cleanliness
FROM public.provider_ratings
GROUP BY provider_id;

GRANT SELECT ON public.provider_rating_summary TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.validate_provider_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.overall IS NULL OR NEW.overall < 0.5 OR NEW.overall > 5 THEN
    RAISE EXCEPTION 'overall must be between 0.5 and 5';
  END IF;
  IF (NEW.overall * 2) <> floor(NEW.overall * 2) THEN
    RAISE EXCEPTION 'overall must be in 0.5 increments';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_provider_rating ON public.provider_ratings;
CREATE TRIGGER trg_validate_provider_rating
BEFORE INSERT OR UPDATE ON public.provider_ratings
FOR EACH ROW EXECUTE FUNCTION public.validate_provider_rating();
