
DROP FUNCTION IF EXISTS public.compute_trip_reservation_state(text, text, uuid, timestamptz, text, text);
DROP FUNCTION IF EXISTS public.compute_ride_reservation_state(text, text, uuid, text, timestamptz);

REVOKE EXECUTE ON FUNCTION public.sync_reservation_states() FROM authenticated;
