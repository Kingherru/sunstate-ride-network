
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS work_hours_start time DEFAULT '06:00'::time,
  ADD COLUMN IF NOT EXISTS work_hours_end   time DEFAULT '20:00'::time;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_start_time time;

CREATE OR REPLACE FUNCTION public.notify_driver_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_first text;
  v_last text;
BEGIN
  IF NEW.assigned_driver_id IS NULL
     OR NEW.assigned_driver_id IS NOT DISTINCT FROM OLD.assigned_driver_id THEN
    RETURN NEW;
  END IF;
  SELECT owner_id, first_name, last_name
    INTO v_owner, v_first, v_last
    FROM public.drivers WHERE id = NEW.assigned_driver_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, ride_request_id)
    VALUES (v_owner, 'driver_schedule_updated',
            'Driver schedule updated',
            coalesce(v_first,'Driver') || ' ' || coalesce(v_last,'') ||
            ' has been scheduled for a trip on ' || NEW.pickup_date ||
            coalesce(' at ' || to_char(NEW.scheduled_start_time, 'HH24:MI'), '') || '.',
            '/dashboard?tab=schedule', NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ride_requests_notify_driver ON public.ride_requests;
CREATE TRIGGER ride_requests_notify_driver
  AFTER UPDATE OF assigned_driver_id ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_driver_on_assignment();
