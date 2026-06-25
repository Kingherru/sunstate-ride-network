-- Payout account per provider
DO $$ BEGIN
  CREATE TYPE public.payout_account_status AS ENUM ('not_connected','pending','active','restricted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.provider_payout_accounts (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id    text UNIQUE,
  status               public.payout_account_status NOT NULL DEFAULT 'not_connected',
  payouts_enabled      boolean NOT NULL DEFAULT false,
  charges_enabled      boolean NOT NULL DEFAULT false,
  details_submitted    boolean NOT NULL DEFAULT false,
  requirements_due     jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.provider_payout_accounts TO authenticated;
GRANT ALL ON public.provider_payout_accounts TO service_role;

ALTER TABLE public.provider_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can view payout account"
  ON public.provider_payout_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner creates their payout account"
  ON public.provider_payout_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only service_role (backend / webhook) may UPDATE fields like status, payouts_enabled, etc.
-- so users can't grant themselves payout privileges.

-- Trip-level payout tracking
DO $$ BEGIN
  CREATE TYPE public.trip_payout_status AS ENUM ('pending','held','released','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS provider_payout_cents integer,
  ADD COLUMN IF NOT EXISTS platform_fee_cents   integer,
  ADD COLUMN IF NOT EXISTS payout_status        public.trip_payout_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payout_released_at   timestamptz,
  ADD COLUMN IF NOT EXISTS payout_transfer_id   text;

CREATE INDEX IF NOT EXISTS trips_payout_status_idx ON public.trips(payout_status, assigned_to);