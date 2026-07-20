CREATE SEQUENCE IF NOT EXISTS public.trip_number_seq;

CREATE OR REPLACE FUNCTION public.trips_autoset_trip_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.trip_number := 'MFN-' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD')
                     || '-' || lpad(nextval('public.trip_number_seq')::text, 6, '0');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trips_autoset_trip_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trips_autoset_trip_number ON public.trips;
CREATE TRIGGER trg_trips_autoset_trip_number
BEFORE INSERT ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.trips_autoset_trip_number();

-- Backfill existing NULL trip numbers BEFORE installing the update-block trigger.
UPDATE public.trips
SET trip_number = 'MFN-' || to_char(coalesce(created_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDD')
                 || '-' || lpad(nextval('public.trip_number_seq')::text, 6, '0')
WHERE trip_number IS NULL;

CREATE OR REPLACE FUNCTION public.trips_block_trip_number_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.trip_number IS DISTINCT FROM OLD.trip_number
     AND current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'trip_number is system-generated and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trips_block_trip_number_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trips_block_trip_number_update ON public.trips;
CREATE TRIGGER trg_trips_block_trip_number_update
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.trips_block_trip_number_update();