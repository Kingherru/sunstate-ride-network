ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS vacation_start date,
  ADD COLUMN IF NOT EXISTS vacation_end date;

CREATE OR REPLACE FUNCTION public.driver_on_vacation(_driver_id uuid, _on date DEFAULT CURRENT_DATE)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = _driver_id
      AND d.vacation_start IS NOT NULL
      AND d.vacation_end IS NOT NULL
      AND _on BETWEEN d.vacation_start AND d.vacation_end
  )
$$;

REVOKE ALL ON FUNCTION public.driver_on_vacation(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_on_vacation(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.block_vacation_driver_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d_rec public.drivers%ROWTYPE;
  ref_date date;
BEGIN
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id THEN
    RETURN NEW;
  END IF;
  SELECT * INTO d_rec FROM public.drivers WHERE id = NEW.driver_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  ref_date := COALESCE(NEW.pickup_date, CURRENT_DATE);
  IF d_rec.vacation_start IS NOT NULL AND d_rec.vacation_end IS NOT NULL
     AND ref_date BETWEEN d_rec.vacation_start AND d_rec.vacation_end THEN
    RAISE EXCEPTION 'Driver % % is on vacation from % to % and cannot be assigned trips on %',
      d_rec.first_name, d_rec.last_name, d_rec.vacation_start, d_rec.vacation_end, ref_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_block_vacation_driver ON public.trips;
CREATE TRIGGER trg_trips_block_vacation_driver
BEFORE INSERT OR UPDATE OF driver_id ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.block_vacation_driver_assignment();