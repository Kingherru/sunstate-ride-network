
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS reservation_state text;

CREATE OR REPLACE FUNCTION public.compute_ride_reservation_state(
  _status text,
  _payment_status text,
  _assigned_provider_id uuid,
  _cancel_reason text,
  _reference_at timestamptz
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN _status IN ('canceled','cancelled','denied','no_show','rejected') OR _cancel_reason IS NOT NULL THEN 'past'
    WHEN _status IN ('completed','delivered') AND _reference_at IS NOT NULL AND _reference_at < now() - interval '30 days' THEN 'history'
    WHEN _status IN ('completed','delivered') THEN 'past'
    WHEN _status IN ('accepted','assigned','confirmed','scheduled','dispatched','en_route','in_progress','arrived','picked_up') THEN 'booked'
    WHEN _assigned_provider_id IS NOT NULL AND _payment_status IN ('paid','authorized','invoiced','captured') THEN 'booked'
    ELSE 'unconfirmed'
  END;
$$;

CREATE OR REPLACE FUNCTION public.ride_requests_sync_reservation_state()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.reservation_state := public.compute_ride_reservation_state(
    NEW.status, NEW.payment_status, NEW.assigned_provider_id, NEW.cancel_reason, COALESCE(NEW.created_at, now())
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ride_requests_sync_reservation_state ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_sync_reservation_state
  BEFORE INSERT OR UPDATE OF status, payment_status, assigned_provider_id, cancel_reason
  ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.ride_requests_sync_reservation_state();

UPDATE public.ride_requests
SET reservation_state = public.compute_ride_reservation_state(
  status, payment_status, assigned_provider_id, cancel_reason, created_at
)
WHERE reservation_state IS NULL;

CREATE INDEX IF NOT EXISTS idx_ride_requests_res_state_requester ON public.ride_requests (reservation_state, requester_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_res_state_provider ON public.ride_requests (reservation_state, assigned_provider_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_res_state_pickup_date ON public.ride_requests (reservation_state, pickup_date);

CREATE OR REPLACE FUNCTION public.promote_past_ride_requests_to_history()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.ride_requests
  SET reservation_state = 'history'
  WHERE reservation_state = 'past'
    AND status IN ('completed','delivered')
    AND created_at < now() - interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.promote_past_ride_requests_to_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_past_ride_requests_to_history() FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN PERFORM cron.unschedule('promote-past-ride-requests-to-history'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule('promote-past-ride-requests-to-history','15 3 * * *',$cron$SELECT public.promote_past_ride_requests_to_history();$cron$);
  END IF;
END $$;
