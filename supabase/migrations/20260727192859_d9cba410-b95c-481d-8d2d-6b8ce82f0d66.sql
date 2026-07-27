
-- 1) Column + backfill
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS unconfirmed_expires_at timestamptz;

UPDATE public.trips
SET unconfirmed_expires_at = COALESCE(created_at, now()) + interval '60 days'
WHERE reservation_state = 'unconfirmed' AND unconfirmed_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trips_unconfirmed_expires_at
  ON public.trips (unconfirmed_expires_at)
  WHERE reservation_state = 'unconfirmed';

-- 2) Trigger: set/clear expiration based on reservation_state transitions
CREATE OR REPLACE FUNCTION public.trips_sync_unconfirmed_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reservation_state = 'unconfirmed' THEN
    IF NEW.unconfirmed_expires_at IS NULL THEN
      NEW.unconfirmed_expires_at := COALESCE(NEW.created_at, now()) + interval '60 days';
    END IF;
  ELSE
    NEW.unconfirmed_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_sync_unconfirmed_expiration ON public.trips;
CREATE TRIGGER trg_trips_sync_unconfirmed_expiration
  BEFORE INSERT OR UPDATE OF reservation_state
  ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trips_sync_unconfirmed_expiration();

-- 3) Admin extend / restore RPC (admin or staff only)
CREATE OR REPLACE FUNCTION public.admin_extend_unconfirmed_reservation(
  _trip_id uuid,
  _days integer DEFAULT 60
) RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_expires timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _days IS NULL OR _days < 1 OR _days > 365 THEN
    RAISE EXCEPTION 'invalid_days';
  END IF;

  -- Restore to unconfirmed if it was auto-expired, then extend
  UPDATE public.trips
     SET status = CASE WHEN status = 'canceled' AND cancel_reason ILIKE 'Auto-expired%' THEN 'pending' ELSE status END,
         cancel_reason = CASE WHEN cancel_reason ILIKE 'Auto-expired%' THEN NULL ELSE cancel_reason END,
         canceled_at = CASE WHEN cancel_reason ILIKE 'Auto-expired%' THEN NULL ELSE canceled_at END,
         reservation_state = 'unconfirmed',
         unconfirmed_expires_at = now() + make_interval(days => _days)
   WHERE id = _trip_id
   RETURNING unconfirmed_expires_at INTO v_new_expires;

  IF v_new_expires IS NULL THEN
    RAISE EXCEPTION 'trip_not_found';
  END IF;

  INSERT INTO public.staff_audit_log (actor_id, action, subject_type, subject_id, details)
  VALUES (auth.uid(), 'extend_unconfirmed_reservation', 'trip', _trip_id,
          jsonb_build_object('days', _days, 'new_expires_at', v_new_expires));

  RETURN v_new_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_extend_unconfirmed_reservation(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_extend_unconfirmed_reservation(uuid, integer) TO authenticated;

-- 4) Auto-cancel expired unconfirmed reservations (daily)
CREATE OR REPLACE FUNCTION public.expire_stale_unconfirmed_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.trips
       SET status = 'canceled',
           cancel_reason = 'Auto-expired after 60 days unconfirmed',
           canceled_at = now()
     WHERE reservation_state = 'unconfirmed'
       AND unconfirmed_expires_at IS NOT NULL
       AND unconfirmed_expires_at < now()
    RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM expired;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_unconfirmed_reservations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_unconfirmed_reservations() FROM anon, authenticated;

-- 5) Daily reminder notifications at 7d / 3d / 1d before expiration
CREATE OR REPLACE FUNCTION public.notify_expiring_unconfirmed_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_days integer;
  v_admin uuid;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT id, assigned_to, created_by, display_id, patient_first_name, patient_last_name,
           pickup_date, unconfirmed_expires_at
      FROM public.trips
     WHERE reservation_state = 'unconfirmed'
       AND unconfirmed_expires_at IS NOT NULL
       AND date_trunc('day', unconfirmed_expires_at) - date_trunc('day', now()) IN (
             interval '7 days', interval '3 days', interval '1 day'
           )
  LOOP
    v_days := EXTRACT(DAY FROM (date_trunc('day', v_row.unconfirmed_expires_at) - date_trunc('day', now())))::int;

    -- Notify assigned provider (if any)
    IF v_row.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, kind, title, body, link_url, severity)
      VALUES (
        v_row.assigned_to,
        'reservation_expiring',
        'Unconfirmed reservation expiring in ' || v_days || ' day' || CASE WHEN v_days = 1 THEN '' ELSE 's' END,
        COALESCE(v_row.display_id, substr(v_row.id::text, 1, 8)) || ' · ' ||
          COALESCE(NULLIF(trim(coalesce(v_row.patient_first_name,'') || ' ' || coalesce(v_row.patient_last_name,'')), ''), 'Patient') ||
          ' — please review or confirm.',
        '/dashboard?tab=trips',
        CASE WHEN v_days <= 1 THEN 'warning' ELSE 'info' END
      )
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;

    -- Also notify admins so MFN can follow up
    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, kind, title, body, link_url, severity)
      VALUES (
        v_admin,
        'reservation_expiring',
        'Unconfirmed reservation expiring in ' || v_days || ' day' || CASE WHEN v_days = 1 THEN '' ELSE 's' END,
        COALESCE(v_row.display_id, substr(v_row.id::text, 1, 8)) || ' · ' ||
          COALESCE(NULLIF(trim(coalesce(v_row.patient_first_name,'') || ' ' || coalesce(v_row.patient_last_name,'')), ''), 'Patient'),
        '/admin?tab=trips',
        CASE WHEN v_days <= 1 THEN 'warning' ELSE 'info' END
      )
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_expiring_unconfirmed_reservations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_expiring_unconfirmed_reservations() FROM anon, authenticated;

-- 6) Schedule both jobs daily
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN PERFORM cron.unschedule('expire-stale-unconfirmed-reservations'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM cron.unschedule('notify-expiring-unconfirmed-reservations'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'expire-stale-unconfirmed-reservations',
      '15 3 * * *',
      $cron$SELECT public.expire_stale_unconfirmed_reservations();$cron$
    );
    PERFORM cron.schedule(
      'notify-expiring-unconfirmed-reservations',
      '30 13 * * *',
      $cron$SELECT public.notify_expiring_unconfirmed_reservations();$cron$
    );
  END IF;
END $$;
