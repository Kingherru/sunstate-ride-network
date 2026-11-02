CREATE TABLE public.provider_api_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.provider_api_credentials(id),
  workspace_id uuid NOT NULL,
  endpoint text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ok','rate_limited','forbidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provider_api_access_events TO authenticated;
GRANT ALL ON public.provider_api_access_events TO service_role;
ALTER TABLE public.provider_api_access_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read own API access history" ON public.provider_api_access_events FOR SELECT TO authenticated
  USING (public.is_provider_workspace_manager(workspace_id, auth.uid()));
CREATE INDEX provider_api_access_events_rate_idx ON public.provider_api_access_events(credential_id, created_at DESC);

CREATE TABLE public.driver_schedule_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.driver_schedule_email_batches(id),
  workspace_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('prepared','sent','failed','skipped')),
  safe_reason text,
  trip_count integer NOT NULL DEFAULT 0,
  actor_user_id uuid NOT NULL,
  actor_mfn_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_schedule_email_deliveries TO authenticated;
GRANT ALL ON public.driver_schedule_email_deliveries TO service_role;
ALTER TABLE public.driver_schedule_email_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read own schedule email deliveries" ON public.driver_schedule_email_deliveries FOR SELECT TO authenticated
  USING (public.is_provider_workspace_manager(workspace_id, auth.uid()));