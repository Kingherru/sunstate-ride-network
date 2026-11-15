-- Isolated destination tests: only temporary objects, all rolled back.
BEGIN;
CREATE TEMP TABLE workspaces(id uuid,account_type text,status text,is_test_account boolean);
CREATE TEMP TABLE workspace_members(workspace_id uuid,user_id uuid,role text,is_contractor boolean,removed_at timestamp);
CREATE TEMP TABLE user_profiles(user_id uuid,status text,is_test_account boolean,deleted_at timestamp);
CREATE TEMP TABLE request_destination(workspace_id uuid,actor_user_id uuid,submitted_via text,selected_provider_workspace_id uuid,is_test boolean,provider_owned_operation boolean,trip_kind text);
DO $$ DECLARE definition text;BEGIN SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='provider_owned_request_source';definition:=replace(definition,'public.','pg_temp.');EXECUTE definition;END $$;
CREATE TRIGGER destination BEFORE INSERT ON pg_temp.request_destination FOR EACH ROW EXECUTE FUNCTION pg_temp.provider_owned_request_source();
INSERT INTO pg_temp.workspaces VALUES ('00000000-0000-4000-8000-000000000001','provider','active',false),('00000000-0000-4000-8000-000000000002','facility','active',false);
INSERT INTO pg_temp.workspace_members SELECT id,'00000000-0000-4000-8000-000000000099','owner',false,NULL FROM pg_temp.workspaces;
INSERT INTO pg_temp.user_profiles VALUES ('00000000-0000-4000-8000-000000000099','active',false,NULL);
INSERT INTO pg_temp.request_destination VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000099','portal',NULL,false,false,'passenger'),('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000099','portal',NULL,false,false,'passenger');
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_temp.request_destination WHERE workspace_id='00000000-0000-4000-8000-000000000001' AND provider_owned_operation AND selected_provider_workspace_id IS NULL) THEN RAISE EXCEPTION 'Provider destination failed';END IF;
IF NOT EXISTS(SELECT 1 FROM pg_temp.request_destination WHERE workspace_id='00000000-0000-4000-8000-000000000002' AND NOT provider_owned_operation AND selected_provider_workspace_id IS NULL) THEN RAISE EXCEPTION 'Unselected facility destination failed';END IF;
END $$;
ROLLBACK;
