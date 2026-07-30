
-- Latest scheduled timestamp for a reservation (uses the return leg for round trips).
CREATE OR REPLACE FUNCTION public.reservation_scheduled_at(
  _pickup_date date,
  _pickup_time time,
  _return_date date,
  _return_time time
) RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT GREATEST(
    CASE WHEN _pickup_date IS NULL THEN NULL
         ELSE (_pickup_date + COALESCE(_pickup_time, time '23:59')) AT TIME ZONE 'America/New_York' END,
    CASE WHEN _return_date IS NULL THEN NULL
         ELSE (_return_date + COALESCE(_return_time, time '23:59')) AT TIME ZONE 'America/New_York' END
  );
$$;

REVOKE ALL ON FUNCTION public.reservation_scheduled_at(date, time, date, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reservation_scheduled_at(date, time, date, time) TO authenticated, service_role;

-- Trips: completed => history, canceled/no-show or past-due => past.
CREATE OR REPLACE FUNCTION public.compute_trip_reservation_state(
  _status text,
  _payment_status text,
  _assigned_to uuid,
  _completed_at timestamptz,
  _cancel_reason text,
  _no_show_reason text,
  _scheduled_at timestamptz
) RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _status = 'completed' THEN 'history'
    WHEN _status IN ('canceled','cancelled','no_show')
      OR _cancel_reason IS NOT NULL
      OR _no_show_reason IS NOT NULL
      THEN 'past'
    -- Scheduled date/time has elapsed but the trip was never completed:
    -- it belongs in Past, where it stays editable and completable.
    WHEN _scheduled_at IS NOT NULL AND _scheduled_at < now() THEN 'past'
    WHEN _status IN ('assigned','accepted','confirmed','scheduled','en_route','in_progress','arrived','picked_up','dispatched')
      THEN 'booked'
    WHEN _assigned_to IS NOT NULL
      AND _payment_status IN ('paid','authorized','invoiced','captured')
      THEN 'booked'
    ELSE 'unconfirmed'
  END;
$$;

REVOKE ALL ON FUNCTION public.compute_trip_reservation_state(text, text, uuid, timestamptz, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_trip_reservation_state(text, text, uuid, timestamptz, text, text, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trips_sync_reservation_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.reservation_state := public.compute_trip_reservation_state(
    NEW.status,
    NEW.payment_status,
    NEW.assigned_to,
    NEW.completed_at,
    NEW.cancel_reason,
    NEW.no_show_reason,
    public.reservation_scheduled_at(
      NEW.pickup_date, NEW.pickup_time,
      CASE WHEN NEW.round_trip THEN NEW.return_date ELSE NULL END,
      NEW.return_pickup_time
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_sync_reservation_state ON public.trips;
CREATE TRIGGER trg_trips_sync_reservation_state
BEFORE INSERT OR UPDATE OF status, payment_status, assigned_to, completed_at,
  cancel_reason, no_show_reason, pickup_date, pickup_time, return_date,
  return_pickup_time, round_trip
ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.trips_sync_reservation_state();

-- Ride requests: same lifecycle.
CREATE OR REPLACE FUNCTION public.compute_ride_reservation_state(
  _status text,
  _payment_status text,
  _assigned_provider_id uuid,
  _cancel_reason text,
  _reference_at timestamptz,
  _scheduled_at timestamptz
) RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _status IN ('completed','delivered') THEN 'history'
    WHEN _status IN ('canceled','cancelled','denied','no_show','rejected')
      OR _cancel_reason IS NOT NULL THEN 'past'
    WHEN _scheduled_at IS NOT NULL AND _scheduled_at < now() THEN 'past'
    WHEN _status IN ('accepted','assigned','confirmed','scheduled','dispatched','en_route','in_progress','arrived','picked_up')
      THEN 'booked'
    WHEN _assigned_provider_id IS NOT NULL
      AND _payment_status IN ('paid','authorized','invoiced','captured') THEN 'booked'
    ELSE 'unconfirmed'
  END;
$$;

REVOKE ALL ON FUNCTION public.compute_ride_reservation_state(text, text, uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_ride_reservation_state(text, text, uuid, text, timestamptz, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ride_requests_sync_reservation_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.reservation_state := public.compute_ride_reservation_state(
    NEW.status, NEW.payment_status, NEW.assigned_provider_id, NEW.cancel_reason,
    COALESCE(NEW.created_at, now()),
    public.reservation_scheduled_at(NEW.pickup_date, NEW.pickup_time, NULL, NULL)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ride_requests_sync_reservation_state ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_sync_reservation_state
BEFORE INSERT OR UPDATE OF status, payment_status, assigned_provider_id,
  cancel_reason, pickup_date, pickup_time
ON public.ride_requests
FOR EACH ROW EXECUTE FUNCTION public.ride_requests_sync_reservation_state();

-- Periodic recompute so elapsed reservations roll into Past without any edit.
CREATE OR REPLACE FUNCTION public.sync_reservation_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.trips t
     SET reservation_state = public.compute_trip_reservation_state(
           t.status, t.payment_status, t.assigned_to, t.completed_at,
           t.cancel_reason, t.no_show_reason,
           public.reservation_scheduled_at(
             t.pickup_date, t.pickup_time,
             CASE WHEN t.round_trip THEN t.return_date ELSE NULL END,
             t.return_pickup_time))
   WHERE t.reservation_state IS DISTINCT FROM public.compute_trip_reservation_state(
           t.status, t.payment_status, t.assigned_to, t.completed_at,
           t.cancel_reason, t.no_show_reason,
           public.reservation_scheduled_at(
             t.pickup_date, t.pickup_time,
             CASE WHEN t.round_trip THEN t.return_date ELSE NULL END,
             t.return_pickup_time));

  UPDATE public.ride_requests r
     SET reservation_state = public.compute_ride_reservation_state(
           r.status, r.payment_status, r.assigned_provider_id, r.cancel_reason,
           COALESCE(r.created_at, now()),
           public.reservation_scheduled_at(r.pickup_date, r.pickup_time, NULL, NULL))
   WHERE r.reservation_state IS DISTINCT FROM public.compute_ride_reservation_state(
           r.status, r.payment_status, r.assigned_provider_id, r.cancel_reason,
           COALESCE(r.created_at, now()),
           public.reservation_scheduled_at(r.pickup_date, r.pickup_time, NULL, NULL));
END;
$$;

REVOKE ALL ON FUNCTION public.sync_reservation_states() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_reservation_states() TO authenticated, service_role;

-- Legacy daily jobs delegate to the unified recompute.
CREATE OR REPLACE FUNCTION public.promote_past_trips_to_history()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN PERFORM public.sync_reservation_states(); END; $$;

CREATE OR REPLACE FUNCTION public.promote_past_ride_requests_to_history()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN PERFORM public.sync_reservation_states(); END; $$;

SELECT cron.schedule('sync-reservation-states', '*/5 * * * *', $$SELECT public.sync_reservation_states();$$);

-- Backfill every existing reservation into the right tab.
SELECT public.sync_reservation_states();
