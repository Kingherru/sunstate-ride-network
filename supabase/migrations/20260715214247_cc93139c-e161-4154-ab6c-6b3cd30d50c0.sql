
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS pay_type text
  CHECK (pay_type IS NULL OR pay_type IN ('hourly','daily_salary','per_trip','per_pickup_leg','per_mile','hybrid'));

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS drivers_user_id_idx ON public.drivers(user_id);

CREATE TABLE IF NOT EXISTS public.driver_earning_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  applied_on date NOT NULL DEFAULT current_date,
  amount_cents integer NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_earning_adjustments TO authenticated;
GRANT ALL ON public.driver_earning_adjustments TO service_role;
ALTER TABLE public.driver_earning_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their driver adjustments"
  ON public.driver_earning_adjustments FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Drivers can view their own adjustments"
  ON public.driver_earning_adjustments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = driver_id AND d.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS driver_earning_adjustments_driver_idx
  ON public.driver_earning_adjustments(driver_id, applied_on);

CREATE TRIGGER trg_driver_earning_adjustments_updated
  BEFORE UPDATE ON public.driver_earning_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.driver_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  period_start date,
  period_end date,
  gross_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid','partial','unpaid')),
  paid_at timestamptz,
  method text,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_payments TO authenticated;
GRANT ALL ON public.driver_payments TO service_role;
ALTER TABLE public.driver_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their driver payments"
  ON public.driver_payments FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Drivers can view their own payments"
  ON public.driver_payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = driver_id AND d.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS driver_payments_driver_idx
  ON public.driver_payments(driver_id, period_end);

CREATE TRIGGER trg_driver_payments_updated
  BEFORE UPDATE ON public.driver_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
