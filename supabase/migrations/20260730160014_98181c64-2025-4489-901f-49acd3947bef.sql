-- 1) Ranked list of eligible providers (extracted from pick_auto_provider)
CREATE OR REPLACE FUNCTION public.rank_auto_providers(
  _pickup_zip text,
  _zone_id uuid,
  _created_by uuid,
  _needs_wheelchair boolean,
  _service_level text,
  _is_medicaid boolean,
  _exclude uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE(user_id uuid, area_rank int, n_recent bigint, rating numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_zip text := substring(regexp_replace(coalesce(_pickup_zip,''), '\D', '', 'g') FROM 1 FOR 5);
  v_zone uuid := _zone_id;
BEGIN
  IF v_zone IS NULL AND v_zip <> '' THEN
    SELECT z.zone_id INTO v_zone FROM public.dispatch_zone_zips z WHERE z.zip = v_zip;
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT mp.user_id,
           coalesce(mp.preferred_zip_codes, ARRAY[]::text[]) AS zips,
           mp.dispatch_zone_id,
           coalesce(mp.long_distance_ok, false) AS long_ok
      FROM public.member_profiles mp
     WHERE mp.membership_status = 'active'
       AND (_created_by IS NULL OR mp.user_id <> _created_by)
       AND NOT (mp.user_id = ANY(coalesce(_exclude, ARRAY[]::uuid[])))
       AND public.is_approved_provider(mp.user_id)
       AND public.provider_has_valid_credentials(mp.user_id)
       AND (NOT coalesce(_is_medicaid, false) OR coalesce(mp.medicaid_verified, false))
       AND (
         NOT coalesce(_is_medicaid, false)
         OR NOT EXISTS (
           SELECT 1 FROM public.provider_applications pa
            WHERE pa.id = mp.provider_application_id
              AND pa.compliance_status IN ('caution','review','denied')
         )
       )
  ),
  fleet AS (
    SELECT v.owner_id,
           bool_or(coalesce(v.wheelchair_accessible,false)) AS has_wc,
           bool_or(coalesce(v.stretcher_capable,false))     AS has_stretcher
      FROM public.vehicles v GROUP BY v.owner_id
  ),
  recent AS (
    SELECT t.assigned_to AS user_id, count(*) AS n_recent
      FROM public.trips t
     WHERE t.assigned_to IS NOT NULL AND t.created_at > now() - interval '14 days'
     GROUP BY t.assigned_to
  ),
  ratings AS (
    SELECT pr.provider_user_id, avg(pr.stars)::numeric AS avg_rating
      FROM public.provider_ratings pr GROUP BY pr.provider_user_id
  ),
  scored AS (
    SELECT e.user_id,
           (CASE WHEN v_zip <> '' AND v_zip = ANY(e.zips) THEN 3
                 WHEN v_zone IS NOT NULL AND e.dispatch_zone_id = v_zone THEN 2
                 WHEN e.long_ok THEN 1
                 ELSE 0 END)::int AS area_rank,
           coalesce(r.n_recent, 0)::bigint AS n_recent,
           coalesce(least(5, ra.avg_rating), 3)::numeric AS rating
      FROM eligible e
      LEFT JOIN fleet f  ON f.owner_id = e.user_id
      LEFT JOIN recent r ON r.user_id  = e.user_id
      LEFT JOIN ratings ra ON ra.provider_user_id = e.user_id
     WHERE (NOT coalesce(_needs_wheelchair,false) OR coalesce(f.has_wc,false))
       AND (coalesce(_service_level,'') <> 'stretcher' OR coalesce(f.has_stretcher,false))
  )
  SELECT s.user_id, s.area_rank, s.n_recent, s.rating
    FROM scored s
   WHERE s.area_rank > 0
   ORDER BY s.area_rank DESC, s.n_recent ASC, s.rating DESC, s.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rank_auto_providers(text, uuid, uuid, boolean, text, boolean, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_auto_providers(text, uuid, uuid, boolean, text, boolean, uuid[]) TO authenticated, service_role;

-- 2) pick_auto_provider now delegates to the ranked list
CREATE OR REPLACE FUNCTION public.pick_auto_provider(
  _pickup_zip text, _zone_id uuid, _created_by uuid,
  _needs_wheelchair boolean, _service_level text, _is_medicaid boolean
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT r.user_id
    FROM public.rank_auto_providers(
      _pickup_zip, _zone_id, _created_by, _needs_wheelchair, _service_level, _is_medicaid
    ) r
   LIMIT 1;
$function$;

-- 3) New trips create a PENDING REFERRAL instead of a hard assignment.
CREATE OR REPLACE FUNCTION public.trips_auto_assign_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pick uuid;
  v_medicaid boolean;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.referral_target_id IS NOT NULL THEN RETURN NEW; END IF;
  IF coalesce(NEW.status, 'open') NOT IN ('open', 'pending', 'new') THEN RETURN NEW; END IF;

  v_medicaid := (
    coalesce(lower(NEW.payer), '') LIKE '%medicaid%'
    OR NEW.medicaid_number IS NOT NULL
    OR NEW.medicaid_plan IS NOT NULL
  );

  v_pick := public.pick_auto_provider(
    NEW.pickup_zip, NEW.dispatch_zone_id, NEW.created_by,
    NEW.needs_wheelchair, NEW.service_level::text, v_medicaid
  );

  -- No eligible provider: leave unassigned for manual dispatch.
  IF v_pick IS NULL THEN RETURN NEW; END IF;

  NEW.referral_target_id := v_pick;
  NEW.referral_status := 'pending';
  NEW.referral_sent_at := now();
  NEW.referral_decided_at := NULL;
  NEW.referral_decline_reason := NULL;
  NEW.auto_assigned_at := now();

  RETURN NEW;
END;
$function$;

-- 4) Notify the referral target after the trip row lands.
CREATE OR REPLACE FUNCTION public.notify_auto_referral_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.referral_status = 'pending' AND NEW.referral_target_id IS NOT NULL THEN
    INSERT INTO public.trip_referral_history (trip_id, from_user_id, to_user_id, action, reason)
    VALUES (NEW.id, NEW.created_by, NEW.referral_target_id, 'sent', 'Auto-routed by service area');

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.referral_target_id,
      'referral_received',
      'New trip referral',
      'A trip in your service area has been referred to you. Review and accept or decline.',
      '/dashboard?trip=' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_trips_notify_auto_referral ON public.trips;
CREATE TRIGGER trg_trips_notify_auto_referral
AFTER INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.notify_auto_referral_target();

-- 5) Re-route to the next eligible provider after a decline.
CREATE OR REPLACE FUNCTION public.refer_next_eligible_provider(_trip_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t record;
  v_medicaid boolean;
  v_excl uuid[];
  v_next uuid;
BEGIN
  SELECT * INTO t FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.assigned_to IS NOT NULL THEN RETURN NULL; END IF;

  SELECT coalesce(array_agg(DISTINCT h.to_user_id), ARRAY[]::uuid[])
    INTO v_excl
    FROM public.trip_referral_history h
   WHERE h.trip_id = _trip_id AND h.action = 'declined' AND h.to_user_id IS NOT NULL;

  v_medicaid := (
    coalesce(lower(t.payer), '') LIKE '%medicaid%'
    OR t.medicaid_number IS NOT NULL
    OR t.medicaid_plan IS NOT NULL
  );

  SELECT r.user_id INTO v_next
    FROM public.rank_auto_providers(
      t.pickup_zip, t.dispatch_zone_id, t.created_by,
      t.needs_wheelchair, t.service_level::text, v_medicaid, v_excl
    ) r
   LIMIT 1;

  IF v_next IS NULL THEN RETURN NULL; END IF;

  UPDATE public.trips
     SET referral_target_id = v_next,
         referral_status = 'pending',
         referral_sent_at = now(),
         referral_decided_at = NULL,
         referral_decline_reason = NULL
   WHERE id = _trip_id;

  INSERT INTO public.trip_referral_history (trip_id, from_user_id, to_user_id, action, reason)
  VALUES (_trip_id, t.created_by, v_next, 'sent', 'Re-routed after decline');

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    v_next,
    'referral_received',
    'New trip referral',
    'A trip in your service area has been referred to you. Review and accept or decline.',
    '/dashboard?trip=' || _trip_id::text
  );

  RETURN v_next;
END;
$function$;

REVOKE ALL ON FUNCTION public.refer_next_eligible_provider(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refer_next_eligible_provider(uuid) TO service_role;