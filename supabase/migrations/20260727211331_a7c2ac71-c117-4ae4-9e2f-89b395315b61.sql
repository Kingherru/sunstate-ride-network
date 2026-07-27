-- Reservation lifecycle: allow approved trips to move to Booked without a
-- separately-assigned provider. Provider-created trips are self-served; the
-- prevent_trip_self_assignment trigger blocks assigned_to = created_by, so
-- classification must not require assigned_to for accepted/scheduled states.
CREATE OR REPLACE FUNCTION public.compute_trip_reservation_state(
  _status text,
  _payment_status text,
  _assigned_to uuid,
  _completed_at timestamp with time zone,
  _cancel_reason text,
  _no_show_reason text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _status IN ('canceled','cancelled','no_show')
      OR _cancel_reason IS NOT NULL
      OR _no_show_reason IS NOT NULL
      THEN 'past'
    WHEN _status = 'completed' AND _completed_at IS NOT NULL AND _completed_at < now() - interval '30 days'
      THEN 'history'
    WHEN _status = 'completed'
      THEN 'past'
    -- Approved / in-progress workflow states move to Booked regardless of
    -- whether a separate provider is assigned. Provider-created trips cannot
    -- self-assign, so requiring assigned_to would strand them in Unconfirmed.
    WHEN _status IN ('assigned','accepted','confirmed','scheduled','en_route','in_progress','arrived','picked_up','dispatched')
      THEN 'booked'
    WHEN _assigned_to IS NOT NULL
      AND _payment_status IN ('paid','authorized','invoiced','captured')
      THEN 'booked'
    ELSE 'unconfirmed'
  END;
$function$;

-- Re-run classification on every existing trip so anything already approved
-- but stuck in Unconfirmed lands in the right tab immediately.
UPDATE public.trips
SET reservation_state = public.compute_trip_reservation_state(
  status, payment_status, assigned_to, completed_at, cancel_reason, no_show_reason
)
WHERE reservation_state IS DISTINCT FROM public.compute_trip_reservation_state(
  status, payment_status, assigned_to, completed_at, cancel_reason, no_show_reason
);