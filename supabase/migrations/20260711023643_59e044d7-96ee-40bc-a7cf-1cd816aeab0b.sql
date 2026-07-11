
-- Helper to generate a random secret
CREATE OR REPLACE FUNCTION public.gen_webhook_secret()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'whsec_' || encode(gen_random_bytes(32), 'hex')
$$;

-- =====================================================
-- Platform-wide webhook endpoints (admin managed)
-- =====================================================
CREATE TABLE public.platform_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL,
  signing_secret text NOT NULL DEFAULT public.gen_webhook_secret(),
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_webhook_endpoints TO authenticated;
GRANT ALL ON public.platform_webhook_endpoints TO service_role;

ALTER TABLE public.platform_webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view platform webhooks"
  ON public.platform_webhook_endpoints FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage platform webhooks"
  ON public.platform_webhook_endpoints FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_platform_webhooks_updated_at
  BEFORE UPDATE ON public.platform_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- Provider-specific webhook endpoints (owner scoped)
-- =====================================================
CREATE TABLE public.provider_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  signing_secret text NOT NULL DEFAULT public.gen_webhook_secret(),
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_webhooks_provider ON public.provider_webhook_endpoints(provider_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_webhook_endpoints TO authenticated;
GRANT ALL ON public.provider_webhook_endpoints TO service_role;

ALTER TABLE public.provider_webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- Providers see only their own; admins see all
CREATE POLICY "Provider or admin can view own webhooks"
  ON public.provider_webhook_endpoints FOR SELECT TO authenticated
  USING (auth.uid() = provider_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Provider can insert own webhooks"
  ON public.provider_webhook_endpoints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = provider_user_id);

CREATE POLICY "Provider or admin can update own webhooks"
  ON public.provider_webhook_endpoints FOR UPDATE TO authenticated
  USING (auth.uid() = provider_user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = provider_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Provider or admin can delete own webhooks"
  ON public.provider_webhook_endpoints FOR DELETE TO authenticated
  USING (auth.uid() = provider_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_provider_webhooks_updated_at
  BEFORE UPDATE ON public.provider_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- Delivery log (isolation enforced)
-- =====================================================
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('platform','provider')),
  platform_endpoint_id uuid REFERENCES public.platform_webhook_endpoints(id) ON DELETE CASCADE,
  provider_endpoint_id uuid REFERENCES public.provider_webhook_endpoints(id) ON DELETE CASCADE,
  provider_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_response_status int,
  last_response_body text,
  last_attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_pending ON public.webhook_deliveries(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_webhook_deliveries_provider ON public.webhook_deliveries(provider_user_id);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Providers only see deliveries tied to their own endpoints (strict isolation)
CREATE POLICY "Provider sees own deliveries; admin sees all"
  ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (scope = 'provider' AND provider_user_id = auth.uid())
  );

-- =====================================================
-- Enqueue helpers (security definer)
-- =====================================================

-- Provider event: fans out to that provider's matching endpoints only.
-- Callable by any authenticated context on behalf of the platform;
-- payload must NOT contain other providers' data.
CREATE OR REPLACE FUNCTION public.enqueue_provider_webhook_event(
  _provider_user_id uuid,
  _event_type text,
  _payload jsonb DEFAULT '{}'::jsonb
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0;
BEGIN
  IF _provider_user_id IS NULL OR _event_type IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.webhook_deliveries
    (scope, provider_endpoint_id, provider_user_id, event_type, payload)
  SELECT 'provider', e.id, e.provider_user_id, _event_type, coalesce(_payload, '{}'::jsonb)
    FROM public.provider_webhook_endpoints e
   WHERE e.provider_user_id = _provider_user_id
     AND e.enabled = true
     AND (_event_type = ANY(e.events) OR '*' = ANY(e.events));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Platform event: admin/service-role only.
CREATE OR REPLACE FUNCTION public.enqueue_platform_webhook_event(
  _event_type text,
  _payload jsonb DEFAULT '{}'::jsonb
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int := 0;
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
BEGIN
  IF v_claims IS NOT NULL THEN
    v_role := (v_claims::jsonb ->> 'role');
  END IF;

  IF v_claims IS NOT NULL AND v_role <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can enqueue platform webhook events';
  END IF;

  INSERT INTO public.webhook_deliveries
    (scope, platform_endpoint_id, event_type, payload)
  SELECT 'platform', e.id, _event_type, coalesce(_payload, '{}'::jsonb)
    FROM public.platform_webhook_endpoints e
   WHERE e.enabled = true
     AND (_event_type = ANY(e.events) OR '*' = ANY(e.events));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- =====================================================
-- Trigger: emit provider event on trip assignment/status change
-- =====================================================
CREATE OR REPLACE FUNCTION public.emit_trip_provider_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event text;
  v_provider uuid;
  v_payload jsonb;
BEGIN
  v_provider := coalesce(NEW.assigned_to, OLD.assigned_to);
  IF v_provider IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    v_event := 'trip.assigned';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'trip.status_changed';
  ELSE
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'trip_id', NEW.id,
    'display_id', NEW.display_id,
    'status', NEW.status,
    'pickup_date', NEW.pickup_date,
    'pickup_time', NEW.pickup_time,
    'assigned_to', NEW.assigned_to,
    'event_at', now()
  );
  PERFORM public.enqueue_provider_webhook_event(v_provider, v_event, v_payload);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_trips_provider_webhook
  AFTER UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.emit_trip_provider_webhook();
