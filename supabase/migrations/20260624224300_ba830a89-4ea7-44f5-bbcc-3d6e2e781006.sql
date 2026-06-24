
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When a subscription becomes active/past_due/canceled, sync membership_status on member_profiles
CREATE OR REPLACE FUNCTION public.sync_member_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_status text;
BEGIN
  IF NEW.status IN ('active', 'trialing') AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now()) THEN
    new_status := 'active';
  ELSIF NEW.status = 'past_due' THEN
    new_status := 'past_due';
  ELSIF NEW.status = 'canceled' AND NEW.current_period_end > now() THEN
    new_status := 'active'; -- grace period
  ELSE
    new_status := 'canceled';
  END IF;

  UPDATE public.member_profiles
    SET membership_status = new_status,
        stripe_customer_id = NEW.stripe_customer_id,
        stripe_subscription_id = NEW.stripe_subscription_id,
        current_period_end = NEW.current_period_end
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.sync_member_status() FROM PUBLIC, authenticated, anon;

CREATE TRIGGER trg_subscriptions_sync_member
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_status();
