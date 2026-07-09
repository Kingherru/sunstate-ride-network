-- Cross-tab realtime sync + payment status for Reservations/Schedule/Referrals/Trip History

-- 1. Enable realtime on the two shared tables so Reservations, Schedule,
--    Referrals and Trip History stay in sync across every open tab.
ALTER TABLE public.trips REPLICA IDENTITY FULL;
ALTER TABLE public.ride_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ride_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_requests;
  END IF;
END $$;

-- 2. Payment status system for Florida NEMT and Provider-to-Provider submissions.
--    Values: not_confirmed | pending | confirmed | refunded
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_payment_status') THEN
    CREATE TYPE public.trip_payment_status AS ENUM (
      'not_confirmed', 'pending', 'confirmed', 'refunded'
    );
  END IF;
END $$;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS payment_status public.trip_payment_status
    NOT NULL DEFAULT 'not_confirmed';

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS payment_status public.trip_payment_status
    NOT NULL DEFAULT 'not_confirmed';

CREATE INDEX IF NOT EXISTS trips_payment_status_idx
  ON public.trips (payment_status);
CREATE INDEX IF NOT EXISTS ride_requests_payment_status_idx
  ON public.ride_requests (payment_status);

-- 3. Server-side setter, only callable by the trip's sender/assignee or ops staff.
CREATE OR REPLACE FUNCTION public.set_trip_payment_status(
  _trip_id uuid,
  _status public.trip_payment_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_trip record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, created_by, assigned_to INTO v_trip FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;

  IF v_trip.created_by <> v_uid
     AND coalesce(v_trip.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid) <> v_uid
     AND NOT public.is_ops_staff(v_uid) THEN
    RAISE EXCEPTION 'Not permitted to change payment status for this trip';
  END IF;

  UPDATE public.trips SET payment_status = _status WHERE id = _trip_id;
END $$;

GRANT EXECUTE ON FUNCTION public.set_trip_payment_status(uuid, public.trip_payment_status) TO authenticated;
