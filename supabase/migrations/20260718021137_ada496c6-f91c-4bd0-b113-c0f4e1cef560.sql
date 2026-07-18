
CREATE TABLE public.subscription_cancellation_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text,
  stripe_customer_id text,
  environment text,
  reason_code text NOT NULL,
  reason_label text,
  comment text,
  plan_tier text,
  price_id text,
  effective_at timestamptz,
  canceled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.subscription_cancellation_reasons TO authenticated;
GRANT ALL ON public.subscription_cancellation_reasons TO service_role;

ALTER TABLE public.subscription_cancellation_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own cancellation"
  ON public.subscription_cancellation_reasons FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own cancellation history"
  ON public.subscription_cancellation_reasons FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Ops staff can view all cancellations"
  ON public.subscription_cancellation_reasons FOR SELECT
  TO authenticated
  USING (public.is_ops_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_sub_cancel_reasons_user ON public.subscription_cancellation_reasons(user_id);
CREATE INDEX idx_sub_cancel_reasons_created ON public.subscription_cancellation_reasons(created_at DESC);
