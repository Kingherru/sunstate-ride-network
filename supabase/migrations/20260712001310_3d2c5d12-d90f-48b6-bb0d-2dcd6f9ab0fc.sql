
-- ============ payers ============
CREATE TABLE public.payers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payers_owner_idx ON public.payers(owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payers TO authenticated;
GRANT ALL ON public.payers TO service_role;
ALTER TABLE public.payers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select payers" ON public.payers FOR SELECT
  TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "owner insert payers" ON public.payers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "owner update payers" ON public.payers FOR UPDATE
  TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "owner delete payers" ON public.payers FOR DELETE
  TO authenticated USING (auth.uid() = owner_user_id);

-- ============ payer_stripe_customers ============
CREATE TABLE public.payer_stripe_customers (
  payer_id UUID NOT NULL REFERENCES public.payers(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  stripe_customer_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (payer_id, environment)
);

GRANT SELECT ON public.payer_stripe_customers TO authenticated;
GRANT ALL ON public.payer_stripe_customers TO service_role;
ALTER TABLE public.payer_stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read payer stripe customers" ON public.payer_stripe_customers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payers p WHERE p.id = payer_id AND p.owner_user_id = auth.uid()));
CREATE POLICY "no client write payer stripe customers" ON public.payer_stripe_customers
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ============ payer_payment_methods ============
CREATE TABLE public.payer_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payer_id UUID NOT NULL REFERENCES public.payers(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  stripe_payment_method_id TEXT NOT NULL,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payer_id, environment, stripe_payment_method_id)
);
CREATE INDEX payer_payment_methods_payer_idx ON public.payer_payment_methods(payer_id);

GRANT SELECT, UPDATE, DELETE ON public.payer_payment_methods TO authenticated;
GRANT ALL ON public.payer_payment_methods TO service_role;
ALTER TABLE public.payer_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select payer cards" ON public.payer_payment_methods FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payers p WHERE p.id = payer_id AND p.owner_user_id = auth.uid()));
CREATE POLICY "owner update payer cards" ON public.payer_payment_methods FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payers p WHERE p.id = payer_id AND p.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.payers p WHERE p.id = payer_id AND p.owner_user_id = auth.uid()));
CREATE POLICY "owner delete payer cards" ON public.payer_payment_methods FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payers p WHERE p.id = payer_id AND p.owner_user_id = auth.uid()));
CREATE POLICY "no client insert payer cards" ON public.payer_payment_methods FOR INSERT
  TO authenticated WITH CHECK (false);

-- ============ default_payer on saved_patients ============
ALTER TABLE public.saved_patients
  ADD COLUMN IF NOT EXISTS default_payer_id UUID REFERENCES public.payers(id) ON DELETE SET NULL;

-- ============ payer_id on ride_requests ============
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS payer_id UUID REFERENCES public.payers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ride_requests_payer_idx ON public.ride_requests(payer_id);

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_payers_updated_at ON public.payers;
CREATE TRIGGER update_payers_updated_at BEFORE UPDATE ON public.payers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payer_stripe_customers_updated_at ON public.payer_stripe_customers;
CREATE TRIGGER update_payer_stripe_customers_updated_at BEFORE UPDATE ON public.payer_stripe_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
