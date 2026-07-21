
-- Promote referred trips to "booked" the moment the referral is accepted.
-- respond_priority_offer() sets status='assigned' + assigned_to on the same trip row,
-- so extending the compute function moves it into Booked Reservations without
-- creating a duplicate record.
CREATE OR REPLACE FUNCTION public.compute_trip_reservation_state(
  _status text,
  _payment_status text,
  _assigned_to uuid,
  _completed_at timestamp with time zone,
  _cancel_reason text,
  _no_show_reason text
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
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
    -- Referral accepted OR normal workflow states -> Booked
    WHEN _status IN ('assigned','accepted','confirmed','scheduled','en_route','in_progress','arrived','picked_up','dispatched')
      AND _assigned_to IS NOT NULL
      THEN 'booked'
    WHEN _assigned_to IS NOT NULL
      AND _payment_status IN ('paid','authorized','invoiced','captured')
      THEN 'booked'
    ELSE 'unconfirmed'
  END;
$$;

-- Backfill existing rows so already-accepted referrals land in the right bucket.
UPDATE public.trips
   SET reservation_state = public.compute_trip_reservation_state(
         status, payment_status, assigned_to, completed_at, cancel_reason, no_show_reason)
 WHERE reservation_state IS DISTINCT FROM public.compute_trip_reservation_state(
         status, payment_status, assigned_to, completed_at, cancel_reason, no_show_reason);
