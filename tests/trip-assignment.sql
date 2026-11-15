-- Run with psql against the project schema. Every fixture is temporary and
-- rolled back; no account, real trip, request or notification is modified.
BEGIN;
CREATE TEMP TABLE trips(id uuid,trip_kind text,status text,contractor_assigned_workspace_id uuid,network_provider_workspace_id uuid,ride_request_id uuid,created_by uuid,assigned_to uuid,transport_type text,driver_id uuid,vehicle_id uuid,pickup_date date,pickup_time time,scheduled_start_time time,assignment_end_time time,estimated_duration_seconds integer,round_trip boolean,return_date date,return_pickup_time time,passenger_count integer,wheelchair_positions integer);
CREATE TEMP TABLE ride_requests(id uuid,workspace_id uuid,provider_owned_operation boolean);
CREATE TEMP TABLE workspaces(id uuid,account_type text,status text);
CREATE TEMP TABLE workspace_members(workspace_id uuid,user_id uuid,removed_at timestamp);
CREATE TEMP TABLE drivers(id uuid,workspace_id uuid,status text,capabilities text[]);
CREATE TEMP TABLE vehicles(id uuid,workspace_id uuid,status text,capacity integer,wheelchair_capacity integer);
CREATE TEMP TABLE trip_dispatch_events(trip_id uuid,event_type text,vendor text,payload jsonb);
CREATE FUNCTION pg_temp.network_workspace_access(ws uuid,manage boolean) RETURNS boolean LANGUAGE sql AS $$ SELECT ws='00000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION pg_temp.business_record_access(ws uuid,kind text,r uuid,level text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION pg_temp.provider_driver_available(d uuid,ws uuid,svc text,dt date) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM pg_temp.drivers WHERE id=d AND workspace_id=ws AND status='active' AND svc=ANY(capabilities)) $$;
CREATE FUNCTION pg_temp.pass4p_service_eligible(ws uuid,svc text,v uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM pg_temp.vehicles WHERE id=v AND workspace_id=ws AND status='active') $$;
DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='assign_trip_resources'; IF definition IS NULL THEN RAISE EXCEPTION 'Assignment RPC absent';END IF; definition:=replace(replace(definition,'public.','pg_temp.'),'auth.uid()','''00000000-0000-4000-8000-000000000099''::uuid'); EXECUTE definition; END $$;
INSERT INTO pg_temp.workspaces VALUES ('00000000-0000-4000-8000-000000000001','provider','active'),('00000000-0000-4000-8000-000000000002','provider','active');
INSERT INTO pg_temp.ride_requests VALUES ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001',true);
INSERT INTO pg_temp.drivers VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','active',ARRAY['ambulatory','wheelchair']),('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000002','active',ARRAY['ambulatory']);
INSERT INTO pg_temp.vehicles VALUES ('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','active',3,1),('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000002','active',3,0);
INSERT INTO pg_temp.trips(id,trip_kind,status,ride_request_id,transport_type,pickup_date,pickup_time,passenger_count,wheelchair_positions) VALUES ('00000000-0000-4000-8000-000000000008','passenger','open','00000000-0000-4000-8000-000000000003','ambulatory','2026-11-20','09:00',2,0),('00000000-0000-4000-8000-000000000009','passenger','open','00000000-0000-4000-8000-000000000003','ambulatory','2026-11-20','09:30',1,0);
DO $$ DECLARE t uuid:='00000000-0000-4000-8000-000000000008';other uuid:='00000000-0000-4000-8000-000000000009';d uuid:='00000000-0000-4000-8000-000000000004';v uuid:='00000000-0000-4000-8000-000000000006'; rejected boolean;BEGIN
PERFORM pg_temp.assign_trip_resources(t,d,v,'09:00','10:00');
IF NOT EXISTS(SELECT 1 FROM pg_temp.trips WHERE id=t AND driver_id=d AND vehicle_id=v AND scheduled_start_time='09:00') THEN RAISE EXCEPTION 'Assignment did not persist';END IF;
rejected:=false;BEGIN PERFORM pg_temp.assign_trip_resources(other,d,v,'09:30','10:30');EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%conflict%' THEN RAISE;END IF;rejected:=true;END;IF NOT rejected OR EXISTS(SELECT 1 FROM pg_temp.trips WHERE id=other AND driver_id IS NOT NULL) THEN RAISE EXCEPTION 'Conflicting assignment changed prior state';END IF;
rejected:=false;BEGIN PERFORM pg_temp.assign_trip_resources(t,'00000000-0000-4000-8000-000000000005',v,'09:00','10:00');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Foreign driver accepted';END IF;
rejected:=false;BEGIN PERFORM pg_temp.assign_trip_resources(t,d,'00000000-0000-4000-8000-000000000007','09:00','10:00');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Foreign vehicle accepted';END IF;
UPDATE pg_temp.drivers SET status='inactive' WHERE id=d;rejected:=false;BEGIN PERFORM pg_temp.assign_trip_resources(t,d,v,'09:00','10:00');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Inactive driver accepted';END IF;UPDATE pg_temp.drivers SET status='active' WHERE id=d;
UPDATE pg_temp.trips SET passenger_count=4 WHERE id=t;rejected:=false;BEGIN PERFORM pg_temp.assign_trip_resources(t,d,v,'09:00','10:00');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Insufficient passenger capacity accepted';END IF;
UPDATE pg_temp.trips SET passenger_count=2,transport_type='wheelchair',wheelchair_positions=2 WHERE id=t;rejected:=false;BEGIN PERFORM pg_temp.assign_trip_resources(t,d,v,'09:00','10:00');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Insufficient wheelchair capacity accepted';END IF;
UPDATE pg_temp.trips SET passenger_count=1,transport_type='ambulatory',wheelchair_positions=0 WHERE id=t;rejected:=false;BEGIN PERFORM pg_temp.assign_trip_resources(t,d,v,'10:00',NULL);EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Unknown duration accepted';END IF;
IF (SELECT count(*) FROM pg_temp.trip_dispatch_events)<>1 THEN RAISE EXCEPTION 'Failures created audit events';END IF;
UPDATE pg_temp.trips SET ride_request_id=NULL,network_provider_workspace_id='00000000-0000-4000-8000-000000000002' WHERE id=t;
rejected:=false;BEGIN PERFORM pg_temp.assign_trip_resources(t,d,v,'09:00','10:00');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'Unauthorized workspace accepted';END IF;
RAISE NOTICE 'Nine isolated assignment assertions passed; real records untouched';END $$;
ROLLBACK;
