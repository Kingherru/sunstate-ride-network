
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS reservation_state text;

CREATE OR REPLACE FUNCTION public.compute_trip_reservation_state(
  _status text,
  _payment_status text,
  _assigned_to uuid,
  _completed_at timestamptz,
  _cancel_reason text,
  _no_show_reason text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _status IN ('canceled','cancelled','no_show')
      OR _cancel_reason IS NOT NULL
      OR _no_show_reason IS NOT NULL
      THEN 'past'
    WHEN _status = 'completed' AND _completed_at IS NOT NULL AND _completed_at < now() - interval '30 days'
      THEN 'history'
    WHEN _status = 'completed'
      THEN 'past'
    WHEN _status IN ('accepted','scheduled','en_route','in_progress','arrived','picked_up','dispatched')
      THEN 'booked'
    WHEN _assigned_to IS NOT NULL
      AND _payment_status IN ('paid','authorized','invoiced','captured')
      THEN 'booked'
    ELSE 'unconfirmed'
  END;
$$;

CREATE OR REPLACE FUNCTION public.trips_sync_reservation_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.reservation_state := public.compute_trip_reservation_state(
    NEW.status,
    NEW.payment_status,
    NEW.assigned_to,
    NEW.completed_at,
    NEW.cancel_reason,
    NEW.no_show_reason
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_sync_reservation_state ON public.trips;
CREATE TRIGGER trg_trips_sync_reservation_state
  BEFORE INSERT OR UPDATE OF status, payment_status, assigned_to, completed_at, cancel_reason, no_show_reason
  ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trips_sync_reservation_state();

UPDATE public.trips
SET reservation_state = public.compute_trip_reservation_state(
  status, payment_status, assigned_to, completed_at, cancel_reason, no_show_reason
)
WHERE reservation_state IS NULL;

CREATE INDEX IF NOT EXISTS idx_trips_reservation_state_created_by
  ON public.trips (reservation_state, created_by);
CREATE INDEX IF NOT EXISTS idx_trips_reservation_state_assigned_to
  ON public.trips (reservation_state, assigned_to);
CREATE INDEX IF NOT EXISTS idx_trips_reservation_state_zone
  ON public.trips (reservation_state, dispatch_zone_id);

CREATE OR REPLACE FUNCTION public.promote_past_trips_to_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trips
  SET reservation_state = 'history'
  WHERE reservation_state = 'past'
    AND status = 'completed'
    AND completed_at IS NOT NULL
    AND completed_at < now() - interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.promote_past_trips_to_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_past_trips_to_history() FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('promote-past-trips-to-history');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'promote-past-trips-to-history',
      '0 3 * * *',
      $cron$SELECT public.promote_past_trips_to_history();$cron$
    );
  END IF;
END $$;
