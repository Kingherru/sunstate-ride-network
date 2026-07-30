
-- Pick the best eligible provider for a trip using ZIP/zone routing + dispatch rules.
CREATE OR REPLACE FUNCTION public.pick_auto_provider(
  _pickup_zip text,
  _zone_id uuid,
  _created_by uuid,
  _needs_wheelchair boolean,
  _service_level text,
  _is_medicaid boolean
)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zip text := substring(regexp_replace(coalesce(_pickup_zip,''), '\D', '', 'g') FROM 1 FOR 5);
  v_zone uuid := _zone_id;
  v_pick uuid;
BEGIN
  IF v_zone IS NULL AND v_zip <> '' THEN
    SELECT zone_id INTO v_zone FROM public.dispatch_zone_zips WHERE zip = v_zip;
  END IF;

  WITH eligible AS (
    SELECT mp.user_id,
           coalesce(mp.preferred_zip_codes, ARRAY[]::text[]) AS zips,
           mp.dispatch_zone_id,
           coalesce(mp.long_distance_ok, false) AS long_ok
      FROM public.member_profiles mp
     WHERE mp.membership_status = 'active'
       AND (_created_by IS NULL OR mp.user_id <> _created_by)
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
    SELECT owner_id,
           bool_or(coalesce(wheelchair_accessible,false)) AS has_wc,
           bool_or(coalesce(stretcher_capable,false))     AS has_stretcher,
           count(*) FILTER (WHERE status='active')        AS n_vehicles
      FROM public.vehicles GROUP BY owner_id
  ),
  recent AS (
    SELECT assigned_to AS user_id, count(*) AS n_recent
      FROM public.trips
     WHERE assigned_to IS NOT NULL AND created_at > now() - interval '14 days'
     GROUP BY assigned_to
  ),
  ratings AS (
    SELECT provider_user_id, avg(stars)::numeric AS avg_rating
      FROM public.provider_ratings GROUP BY provider_user_id
  ),
  scored AS (
    SELECT e.user_id,
           (CASE WHEN v_zip <> '' AND v_zip = ANY(e.zips) THEN 3
                 WHEN v_zone IS NOT NULL AND e.dispatch_zone_id = v_zone THEN 2
                 WHEN e.long_ok THEN 1
                 ELSE 0 END) AS area_rank,
           coalesce(r.n_recent, 0) AS n_recent,
           coalesce(least(5, ra.avg_rating), 3) AS rating
      FROM eligible e
      LEFT JOIN fleet f  ON f.owner_id = e.user_id
      LEFT JOIN recent r ON r.user_id  = e.user_id
      LEFT JOIN ratings ra ON ra.provider_user_id = e.user_id
     WHERE (NOT coalesce(_needs_wheelchair,false) OR coalesce(f.has_wc,false))
       AND (coalesce(_service_level,'') <> 'stretcher' OR coalesce(f.has_stretcher,false))
  )
  SELECT user_id INTO v_pick
    FROM scored
   WHERE area_rank > 0
   ORDER BY area_rank DESC, n_recent ASC, rating DESC, user_id
   LIMIT 1;

  RETURN v_pick;
END;
$$;

REVOKE ALL ON FUNCTION public.pick_auto_provider(text, uuid, uuid, boolean, text, boolean) FROM PUBLIC;

-- BEFORE INSERT auto-assignment (runs after dispatch-zone routing,
-- before reservation-state sync).
CREATE OR REPLACE FUNCTION public.trips_auto_assign_provider()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pick uuid;
  v_medicaid boolean;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN RETURN NEW; END IF;
  IF coalesce(NEW.status, 'open') NOT IN ('open', 'pending', 'new') THEN RETURN NEW; END IF;

  v_medicaid := (
    coalesce(lower(NEW.payer), '') LIKE '%medicaid%'
    OR NEW.medicaid_number IS NOT NULL
    OR NEW.medicaid_plan IS NOT NULL
  );

  v_pick := public.pick_auto_provider(
    NEW.pickup_zip,
    NEW.dispatch_zone_id,
    NEW.created_by,
    NEW.needs_wheelchair,
    NEW.service_level::text,
    v_medicaid
  );

  IF v_pick IS NOT NULL THEN
    NEW.assigned_to := v_pick;
    NEW.status := 'assigned';
    NEW.auto_assigned_at := now();
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS auto_assigned_at timestamptz;

DROP TRIGGER IF EXISTS trg_trips_dz_auto_assign ON public.trips;
CREATE TRIGGER trg_trips_dz_auto_assign
  BEFORE INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.trips_auto_assign_provider();

-- Staff-triggered auto-assignment for an existing unassigned trip.
CREATE OR REPLACE FUNCTION public.auto_assign_trip(_trip_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  v_pick uuid;
  v_medicaid boolean;
BEGIN
  IF NOT public.is_ops_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO t FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.assigned_to IS NOT NULL THEN RETURN t.assigned_to; END IF;

  v_medicaid := (
    coalesce(lower(t.payer), '') LIKE '%medicaid%'
    OR t.medicaid_number IS NOT NULL
    OR t.medicaid_plan IS NOT NULL
  );

  v_pick := public.pick_auto_provider(
    t.pickup_zip, t.dispatch_zone_id, t.created_by,
    t.needs_wheelchair, t.service_level::text, v_medicaid
  );

  IF v_pick IS NULL THEN RETURN NULL; END IF;

  UPDATE public.trips
     SET assigned_to = v_pick,
         status = 'assigned',
         auto_assigned_at = now()
   WHERE id = _trip_id;

  RETURN v_pick;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_assign_trip(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_assign_trip(uuid) TO authenticated;
