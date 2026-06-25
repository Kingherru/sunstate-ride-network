DROP VIEW IF EXISTS public.provider_rating_summary;
CREATE VIEW public.provider_rating_summary
WITH (security_invoker = on) AS
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