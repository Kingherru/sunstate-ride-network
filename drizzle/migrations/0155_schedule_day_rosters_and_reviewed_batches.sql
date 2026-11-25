ALTER TABLE public.user_portal_preferences ADD COLUMN schedule_clock text NOT NULL DEFAULT '12';
ALTER TABLE public.user_portal_preferences ADD CONSTRAINT schedule_clock_values CHECK(schedule_clock IN ('12','24'));
ALTER TABLE public.workspaces ADD COLUMN driver_assignment_sms_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN assignment_sms_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.schedule_day_drivers (workspace_id uuid NOT NULL REFERENCES public.workspaces(id),service_date date NOT NULL,driver_id uuid NOT NULL REFERENCES public.drivers(id),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,service_date,driver_id));
GRANT SELECT ON public.schedule_day_drivers TO authenticated;
GRANT ALL ON public.schedule_day_drivers TO service_role;
ALTER TABLE public.schedule_day_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY schedule_roster_read ON public.schedule_day_drivers FOR SELECT TO authenticated USING(public.network_workspace_access(workspace_id,false) AND public.business_record_access(workspace_id,'drivers',driver_id,'read'));
CREATE FUNCTION public.schedule_day_roster(_workspace uuid,_date date) RETURNS TABLE(driver_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.network_workspace_access(_workspace,false) THEN RAISE EXCEPTION 'Schedule access required';END IF;
RETURN QUERY SELECT r.driver_id FROM public.schedule_day_drivers r WHERE r.workspace_id=_workspace AND r.service_date=_date AND public.business_record_access(_workspace,'drivers',r.driver_id,'read') UNION SELECT t.driver_id FROM public.trips t JOIN public.drivers d ON d.id=t.driver_id WHERE t.pickup_date=_date AND d.workspace_id=_workspace AND t.status NOT IN ('completed','canceled','cancelled','no_show') AND public.business_record_access(_workspace,'drivers',d.id,'read');END $$;
REVOKE ALL ON FUNCTION public.schedule_day_roster(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.schedule_day_roster(uuid,date) TO authenticated;
CREATE FUNCTION public.set_schedule_day_driver(_workspace uuid,_date date,_driver uuid,_scheduled boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE ev uuid;BEGIN
IF _date IS NULL OR _scheduled IS NULL OR NOT public.network_workspace_access(_workspace,true) OR NOT public.business_record_access(_workspace,'drivers',_driver,'read') THEN RAISE EXCEPTION 'Schedule management required';END IF;
PERFORM 1 FROM public.workspaces WHERE id=_workspace FOR UPDATE;
PERFORM 1 FROM public.drivers WHERE id=_driver AND workspace_id=_workspace;IF NOT FOUND THEN RAISE EXCEPTION 'Workspace driver required';END IF;
IF _scheduled THEN
IF EXISTS(SELECT 1 FROM public.drivers d WHERE d.id=_driver AND (d.status<>'active' OR (_date BETWEEN d.vacation_start AND d.vacation_end) OR (d.availability->>'mode'='weekly' AND (d.availability->'days'->(extract(dow FROM _date)::int::text) IS NULL OR coalesce((d.availability->'days'->(extract(dow FROM _date)::int::text)->>'off')::boolean,false))))) THEN RAISE EXCEPTION 'Driver unavailable on this day';END IF;
INSERT INTO public.schedule_day_drivers(workspace_id,service_date,driver_id,created_by) VALUES(_workspace,_date,_driver,auth.uid()) ON CONFLICT DO NOTHING;
ELSE
IF EXISTS(SELECT 1 FROM public.trips WHERE driver_id=_driver AND pickup_date=_date AND status NOT IN ('completed','canceled','cancelled','no_show')) THEN RAISE EXCEPTION 'Unschedule this driver''s trips first';END IF;
DELETE FROM public.schedule_day_drivers WHERE workspace_id=_workspace AND service_date=_date AND driver_id=_driver;
END IF;
IF FOUND THEN INSERT INTO public.account_security_audit(user_id,workspace_id,event_type,driver_ids,range_start,range_end,result,details) VALUES(auth.uid(),_workspace,'schedule_driver_changed',ARRAY[_driver],_date,_date,'saved',jsonb_build_object('kind',CASE WHEN _scheduled THEN 'rostered' ELSE 'removed' END,'driverId',_driver,'date',_date)) RETURNING id INTO ev;END IF;RETURN ev;END $$;
REVOKE ALL ON FUNCTION public.set_schedule_day_driver(uuid,date,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_schedule_day_driver(uuid,date,uuid,boolean) TO authenticated;
CREATE FUNCTION public.retain_schedule_day_driver() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE ws uuid;dr uuid;BEGIN
IF NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id AND NEW.scheduled_start_time IS NOT DISTINCT FROM OLD.scheduled_start_time AND NEW.assignment_end_time IS NOT DISTINCT FROM OLD.assignment_end_time THEN RETURN NEW;END IF;
FOREACH dr IN ARRAY ARRAY[OLD.driver_id,NEW.driver_id] LOOP
IF dr IS NULL THEN CONTINUE;END IF;SELECT workspace_id INTO ws FROM public.drivers WHERE id=dr;IF ws IS NULL THEN CONTINUE;END IF;
INSERT INTO public.schedule_day_drivers(workspace_id,service_date,driver_id,created_by) VALUES(ws,NEW.pickup_date,dr,coalesce(auth.uid(),NEW.created_by)) ON CONFLICT DO NOTHING;
INSERT INTO public.account_security_audit(user_id,workspace_id,event_type,driver_ids,range_start,range_end,result,correlation_id,details) VALUES(coalesce(auth.uid(),NEW.created_by),ws,'schedule_driver_changed',ARRAY[dr],NEW.pickup_date,NEW.pickup_date,'saved',NEW.id,jsonb_build_object('driverId',dr,'date',NEW.pickup_date,'time',NEW.scheduled_start_time,'kind',CASE WHEN dr=NEW.driver_id THEN 'assignment_changed' ELSE 'assignment_removed' END));
EXIT WHEN OLD.driver_id IS NOT DISTINCT FROM NEW.driver_id;
END LOOP;RETURN NEW;END $$;
REVOKE ALL ON FUNCTION public.retain_schedule_day_driver() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER retain_schedule_roster AFTER UPDATE OF driver_id,scheduled_start_time,assignment_end_time ON public.trips FOR EACH ROW EXECUTE FUNCTION public.retain_schedule_day_driver();
CREATE FUNCTION public.confirm_schedule_batch(_workspace uuid,_date date,_key uuid,_items jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i jsonb;t public.trips;BEGIN
IF _key IS NULL OR _date IS NULL OR NOT public.network_workspace_access(_workspace,true) OR jsonb_typeof(_items) IS DISTINCT FROM 'array' OR jsonb_array_length(_items) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Reviewed schedule batch required';END IF;
PERFORM 1 FROM public.workspaces WHERE id=_workspace FOR UPDATE;
IF EXISTS(SELECT 1 FROM public.account_security_audit WHERE workspace_id=_workspace AND event_type='schedule_batch_confirmed' AND correlation_id=_key) THEN RETURN;END IF;
IF (SELECT count(DISTINCT value->>'tripId') FROM jsonb_array_elements(_items))<>jsonb_array_length(_items) THEN RAISE EXCEPTION 'Duplicate trip in batch';END IF;
PERFORM 1 FROM public.trips WHERE id IN (SELECT (value->>'tripId')::uuid FROM jsonb_array_elements(_items)) ORDER BY id FOR UPDATE;
FOR i IN SELECT value FROM jsonb_array_elements(_items) LOOP
SELECT * INTO t FROM public.trips WHERE id=(i->>'tripId')::uuid;
IF t.id IS NULL OR t.pickup_date<>_date OR t.driver_id IS NOT NULL OR t.updated_at IS DISTINCT FROM (i->>'version')::timestamptz THEN RAISE EXCEPTION 'Trip changed since review; refresh recommendations';END IF;
IF NOT EXISTS(SELECT 1 FROM public.schedule_day_roster(_workspace,_date) r JOIN public.drivers d ON d.id=r.driver_id WHERE r.driver_id=(i->>'driverId')::uuid AND d.workspace_id=_workspace) THEN RAISE EXCEPTION 'Driver no longer scheduled';END IF;
PERFORM public.assign_trip_resources(t.id,(i->>'driverId')::uuid,(i->>'vehicleId')::uuid,(i->>'start')::time,(i->>'end')::time);
END LOOP;
INSERT INTO public.account_security_audit(user_id,workspace_id,event_type,range_start,range_end,result,correlation_id,details) VALUES(auth.uid(),_workspace,'schedule_batch_confirmed',_date,_date,'saved',_key,jsonb_build_object('count',jsonb_array_length(_items)));END $$;
REVOKE ALL ON FUNCTION public.confirm_schedule_batch(uuid,date,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_schedule_batch(uuid,date,uuid,jsonb) TO authenticated;