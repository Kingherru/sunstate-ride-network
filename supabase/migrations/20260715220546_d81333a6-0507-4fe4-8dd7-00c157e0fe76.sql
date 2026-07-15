
CREATE TABLE public.driver_earnings_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'sent',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX driver_earnings_reports_driver_idx ON public.driver_earnings_reports(driver_id, sent_at DESC);
CREATE INDEX driver_earnings_reports_owner_idx ON public.driver_earnings_reports(owner_id, sent_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_earnings_reports TO authenticated;
GRANT ALL ON public.driver_earnings_reports TO service_role;

ALTER TABLE public.driver_earnings_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their earnings reports"
  ON public.driver_earnings_reports
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Drivers can view their own earnings reports"
  ON public.driver_earnings_reports
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = driver_earnings_reports.driver_id AND d.user_id = auth.uid()
  ));
