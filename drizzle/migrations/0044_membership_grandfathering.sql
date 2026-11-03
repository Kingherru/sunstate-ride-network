CREATE TABLE public.provider_membership_grandfathering (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  subscription_row_id uuid NOT NULL UNIQUE,
  environment text NOT NULL,
  original_cents integer NOT NULL,
  eligible boolean NOT NULL DEFAULT true,
  effective_at timestamptz,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'prepared',
  prepared_at timestamptz NOT NULL DEFAULT now(),
  prepared_by uuid
);
GRANT SELECT ON public.provider_membership_grandfathering TO authenticated;
GRANT ALL ON public.provider_membership_grandfathering TO service_role;
ALTER TABLE public.provider_membership_grandfathering ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master admin reads grandfathering" ON public.provider_membership_grandfathering
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.grandfathering_set_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.expires_at := CASE WHEN NEW.effective_at IS NULL THEN NULL ELSE NEW.effective_at + interval '12 months' END;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_grandfathering_expiry BEFORE INSERT OR UPDATE ON public.provider_membership_grandfathering
  FOR EACH ROW EXECUTE FUNCTION public.grandfathering_set_expiry();

-- Records eligibility only; never sets an effective date and never touches subscriptions.
CREATE OR REPLACE FUNCTION public.prepare_membership_grandfathering()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Master Admin only'; END IF;
  INSERT INTO public.provider_membership_grandfathering (workspace_id, subscription_row_id, environment, original_cents, prepared_by)
  SELECT s.workspace_id, s.id, s.environment,
         COALESCE(s.base_price_cents, CASE WHEN s.price_id = 'nemt_membership_monthly_v2' THEN 1000 ELSE 1500 END), auth.uid()
  FROM public.subscriptions s
  WHERE s.workspace_id IS NOT NULL
    AND s.price_id IN ('nemt_provider_base_monthly', 'nemt_membership_monthly_v2')
    AND s.status IN ('active', 'trialing', 'past_due')
    AND COALESCE(s.base_price_cents, 0) < 2000
  ON CONFLICT (subscription_row_id) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.prepare_membership_grandfathering() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.prepare_membership_grandfathering() TO authenticated;