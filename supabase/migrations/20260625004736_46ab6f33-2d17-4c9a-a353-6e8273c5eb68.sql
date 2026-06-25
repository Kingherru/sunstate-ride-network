CREATE TABLE IF NOT EXISTS public.provider_payout_transfers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id              uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  provider_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id    text NOT NULL,
  stripe_transfer_id   text UNIQUE,
  gross_cents          integer NOT NULL,
  fee_cents            integer NOT NULL,
  net_cents            integer NOT NULL,
  status               text NOT NULL DEFAULT 'pending',
  failure_reason       text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.provider_payout_transfers TO authenticated;
GRANT ALL    ON public.provider_payout_transfers TO service_role;

ALTER TABLE public.provider_payout_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provider or admin can view their payout transfers"
  ON public.provider_payout_transfers FOR SELECT
  TO authenticated
  USING (auth.uid() = provider_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS provider_payout_transfers_provider_idx
  ON public.provider_payout_transfers(provider_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS provider_payout_transfers_trip_idx
  ON public.provider_payout_transfers(trip_id);

CREATE TRIGGER set_updated_at_provider_payout_transfers
  BEFORE UPDATE ON public.provider_payout_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();