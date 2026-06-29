
-- Stripe customers (one per user, per environment)
CREATE TABLE public.stripe_customers (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  stripe_customer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, environment)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_customers TO authenticated;
GRANT ALL ON public.stripe_customers TO service_role;
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read" ON public.stripe_customers FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- writes go through server fns using service role; deny direct client writes
CREATE POLICY "no client write" ON public.stripe_customers FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Saved payment methods (tokens only — no PAN/CVV)
CREATE TABLE public.saved_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  stripe_payment_method_id text NOT NULL,
  brand text,
  last4 text,
  exp_month int,
  exp_year int,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, environment, stripe_payment_method_id)
);
GRANT SELECT, UPDATE, DELETE ON public.saved_payment_methods TO authenticated;
GRANT ALL ON public.saved_payment_methods TO service_role;
ALTER TABLE public.saved_payment_methods ENABLE ROW LEVEL SECURITY;
-- Owner-only. NOTE: no admin/staff/dispatcher policy by design.
CREATE POLICY "owner select" ON public.saved_payment_methods FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner update default flag" ON public.saved_payment_methods FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner delete" ON public.saved_payment_methods FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Inserts only via server fn (service role); block client inserts.
CREATE POLICY "no client insert" ON public.saved_payment_methods FOR INSERT TO authenticated WITH CHECK (false);

-- Trip payments
CREATE TABLE public.trip_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  ride_request_id uuid REFERENCES public.ride_requests(id) ON DELETE SET NULL,
  payer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  stripe_payment_intent_id text NOT NULL,
  amount_cents int NOT NULL,
  platform_fee_cents int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trip_payments TO authenticated;
GRANT ALL ON public.trip_payments TO service_role;
ALTER TABLE public.trip_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payer read own" ON public.trip_payments FOR SELECT TO authenticated USING (auth.uid() = payer_user_id);
CREATE POLICY "provider read own" ON public.trip_payments FOR SELECT TO authenticated USING (auth.uid() = provider_user_id);
CREATE POLICY "admin read all" ON public.trip_payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Payment status on ride_requests and trips
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid','authorized','paid','refunded','failed'));
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid','authorized','paid','refunded','failed'));

-- updated_at triggers
CREATE TRIGGER stripe_customers_updated BEFORE UPDATE ON public.stripe_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trip_payments_updated BEFORE UPDATE ON public.trip_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
