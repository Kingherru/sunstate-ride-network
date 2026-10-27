ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'submitted';
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

CREATE TABLE public.request_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid NOT NULL REFERENCES public.ride_requests(id),
  actor_user_id uuid,
  actor_mfn_id text,
  action text NOT NULL,
  from_state text,
  to_state text,
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.request_status_events TO authenticated;
GRANT ALL ON public.request_status_events TO service_role;
ALTER TABLE public.request_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins with request access read lifecycle history" ON public.request_status_events FOR SELECT TO authenticated
  USING (public.admin_can('requests','read') AND public.admin_can_account((SELECT r.workspace_id FROM public.ride_requests r WHERE r.id = ride_request_id)));
CREATE INDEX request_status_events_request_idx ON public.request_status_events(ride_request_id, created_at);

CREATE FUNCTION public.request_status_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Request history is append-only'; END $$;
CREATE TRIGGER request_status_events_no_change BEFORE UPDATE OR DELETE ON public.request_status_events
  FOR EACH ROW EXECUTE FUNCTION public.request_status_events_append_only();

CREATE FUNCTION public.request_lifecycle_allowed(_from text, _to text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (_from, _to) IN (
    ('submitted','in_review'),('submitted','cancelled'),
    ('in_review','distributed'),('in_review','accepted'),('in_review','declined'),('in_review','cancelled'),('in_review','no_provider_available'),
    ('distributed','provider_viewed'),('distributed','accepted'),('distributed','no_provider_available'),('distributed','cancelled'),('distributed','distributed'),
    ('provider_viewed','accepted'),('provider_viewed','no_provider_available'),('provider_viewed','cancelled'),('provider_viewed','distributed'),
    ('no_provider_available','distributed'),('no_provider_available','cancelled'),
    ('accepted','completed'),('accepted','cancelled')
  )
$$;

CREATE FUNCTION public.transition_request_lifecycle(_request uuid, _to text, _note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur text; ws uuid; mfn text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT lifecycle_state, workspace_id INTO cur, ws FROM public.ride_requests WHERE id = _request AND deactivated_at IS NULL FOR UPDATE;
  IF cur IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT (public.admin_can('requests','manage') AND public.admin_can_account(ws)) THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _to = 'provider_viewed' THEN RAISE EXCEPTION 'Provider Viewed is recorded only by the provider'; END IF;
  IF NOT public.request_lifecycle_allowed(cur, _to) THEN RAISE EXCEPTION 'That status change is not allowed'; END IF;
  SELECT mfn_id INTO mfn FROM public.user_profiles WHERE user_id = auth.uid();
  UPDATE public.ride_requests SET lifecycle_state = _to WHERE id = _request;
  INSERT INTO public.request_status_events(ride_request_id, actor_user_id, actor_mfn_id, action, from_state, to_state, note)
  VALUES (_request, auth.uid(), mfn, 'status_change', cur, _to, nullif(left(trim(coalesce(_note,'')),500),''));
  RETURN _to;
END $$;
REVOKE ALL ON FUNCTION public.transition_request_lifecycle(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_request_lifecycle(uuid,text,text) TO authenticated;

CREATE FUNCTION public.record_request_provider_viewed(_request uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur text; target uuid; mfn text;
BEGIN
  SELECT lifecycle_state, selected_provider_workspace_id INTO cur, target FROM public.ride_requests WHERE id = _request AND deactivated_at IS NULL FOR UPDATE;
  IF cur IS DISTINCT FROM 'distributed' OR target IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = target AND m.user_id = auth.uid() AND m.removed_at IS NULL AND m.is_contractor = false) THEN RETURN false; END IF;
  SELECT mfn_id INTO mfn FROM public.user_profiles WHERE user_id = auth.uid();
  UPDATE public.ride_requests SET lifecycle_state = 'provider_viewed' WHERE id = _request;
  INSERT INTO public.request_status_events(ride_request_id, actor_user_id, actor_mfn_id, action, from_state, to_state)
  VALUES (_request, auth.uid(), mfn, 'provider_viewed', cur, 'provider_viewed');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_request_provider_viewed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_request_provider_viewed(uuid) TO authenticated;

CREATE TABLE public.platform_launch_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_launch_flags TO authenticated;
GRANT ALL ON public.platform_launch_flags TO service_role;
ALTER TABLE public.platform_launch_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read launch flags" ON public.platform_launch_flags FOR SELECT TO authenticated USING (public.admin_can('requests','read'));
CREATE FUNCTION public.launch_flag_enabled(_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT enabled FROM public.platform_launch_flags WHERE key = _key), false)
$$;
REVOKE ALL ON FUNCTION public.launch_flag_enabled(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.launch_flag_enabled(text) TO authenticated, service_role;
COMMENT ON TABLE public.platform_launch_flags IS 'Server launch switches; a missing row means OFF (automatic_distribution stays off until launch).';

ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON public.contact_messages(created_at DESC);