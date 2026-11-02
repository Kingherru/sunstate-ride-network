-- Fleet resource status history (append-only)
CREATE TABLE public.fleet_resource_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  resource_kind text NOT NULL CHECK (resource_kind IN ('driver','vehicle')),
  resource_id uuid NOT NULL,
  resource_reference text,
  previous_status text,
  new_status text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  actor_user_id uuid NOT NULL,
  actor_mfn_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fleet_resource_status_events TO authenticated;
GRANT ALL ON public.fleet_resource_status_events TO service_role;
ALTER TABLE public.fleet_resource_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read fleet status history" ON public.fleet_resource_status_events FOR SELECT TO authenticated
  USING (public.is_provider_workspace_manager(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.set_fleet_resource_status(_kind text, _id uuid, _status text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid; prev text; ref text; actor_mfn text;
BEGIN
  IF auth.uid() IS NULL OR _status NOT IN ('active','inactive') OR length(btrim(coalesce(_reason,''))) < 3 THEN
    RAISE EXCEPTION 'unavailable';
  END IF;
  IF _kind = 'driver' THEN
    SELECT workspace_id, status, creator_mfn_id || ':' || left(id::text, 8) INTO ws, prev, ref FROM drivers WHERE id = _id FOR UPDATE;
  ELSIF _kind = 'vehicle' THEN
    SELECT workspace_id, status, coalesce(name,'') || ' · ' || left(id::text, 8) INTO ws, prev, ref FROM vehicles WHERE id = _id FOR UPDATE;
  ELSE RAISE EXCEPTION 'unavailable'; END IF;
  IF ws IS NULL OR NOT public.is_provider_workspace_manager(ws, auth.uid()) THEN RAISE EXCEPTION 'unavailable'; END IF;
  IF prev = _status THEN RETURN jsonb_build_object('ok', true, 'unchanged', true); END IF;
  IF _kind = 'driver' THEN UPDATE drivers SET status = _status, updated_at = now() WHERE id = _id;
  ELSE UPDATE vehicles SET status = _status, updated_at = now() WHERE id = _id; END IF;
  SELECT mfn_id INTO actor_mfn FROM user_profiles WHERE id = auth.uid();
  INSERT INTO fleet_resource_status_events(workspace_id, resource_kind, resource_id, resource_reference, previous_status, new_status, reason, actor_user_id, actor_mfn_id)
  VALUES (ws, _kind, _id, ref, prev, _status, btrim(_reason), auth.uid(), actor_mfn);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.set_fleet_resource_status(text, uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_fleet_resource_status(text, uuid, text, text) TO authenticated;

-- Inactive resources cannot receive NEW assignments; existing assignments are untouched.
CREATE OR REPLACE FUNCTION public.block_inactive_fleet_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL AND NEW.driver_id IS DISTINCT FROM OLD.driver_id
     AND EXISTS (SELECT 1 FROM drivers WHERE id = NEW.driver_id AND status = 'inactive') THEN
    RAISE EXCEPTION 'This driver is inactive and cannot receive new assignments.';
  END IF;
  IF NEW.vehicle_id IS NOT NULL AND NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
     AND EXISTS (SELECT 1 FROM vehicles WHERE id = NEW.vehicle_id AND status = 'inactive') THEN
    RAISE EXCEPTION 'This vehicle is inactive and cannot receive new assignments.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_trips_block_inactive_fleet BEFORE UPDATE OF driver_id, vehicle_id ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.block_inactive_fleet_assignment();

-- Provider API credentials: hash-only storage, read-only export scope by default.
CREATE TABLE public.provider_api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
  scopes text[] NOT NULL DEFAULT ARRAY['exports:read']::text[] CHECK (scopes <@ ARRAY['exports:read','schedule:read']::text[] AND cardinality(scopes) > 0),
  secret_hash text NOT NULL,
  key_prefix text NOT NULL,
  key_last4 text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_by uuid NOT NULL,
  created_by_mfn_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz,
  revoked_by_mfn_id text,
  replaced_by uuid
);
GRANT SELECT ON public.provider_api_credentials TO authenticated;
GRANT ALL ON public.provider_api_credentials TO service_role;
ALTER TABLE public.provider_api_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read own API credentials" ON public.provider_api_credentials FOR SELECT TO authenticated
  USING (public.is_provider_workspace_manager(workspace_id, auth.uid()));
REVOKE SELECT (secret_hash) ON public.provider_api_credentials FROM authenticated;

CREATE TABLE public.provider_api_credential_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.provider_api_credentials(id),
  workspace_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('created','renamed','rotated','revoked')),
  detail text,
  actor_user_id uuid NOT NULL,
  actor_mfn_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_api_credential_events TO authenticated;
GRANT ALL ON public.provider_api_credential_events TO service_role;
ALTER TABLE public.provider_api_credential_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read own API credential history" ON public.provider_api_credential_events FOR SELECT TO authenticated
  USING (public.is_provider_workspace_manager(workspace_id, auth.uid()));

-- Driver schedule email batches: prepared/audited only; sending stays behind an OFF launch flag.
CREATE TABLE public.driver_schedule_email_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  driver_ids uuid[] NOT NULL,
  range_start date NOT NULL,
  range_end date NOT NULL,
  trip_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','sent','failed')),
  sent_count integer NOT NULL DEFAULT 0,
  actor_user_id uuid NOT NULL,
  actor_mfn_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_schedule_email_batches TO authenticated;
GRANT ALL ON public.driver_schedule_email_batches TO service_role;
ALTER TABLE public.driver_schedule_email_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read own schedule email batches" ON public.driver_schedule_email_batches FOR SELECT TO authenticated
  USING (public.is_provider_workspace_manager(workspace_id, auth.uid()));