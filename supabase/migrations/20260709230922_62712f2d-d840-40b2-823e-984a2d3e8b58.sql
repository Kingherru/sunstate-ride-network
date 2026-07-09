
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS billing_contact jsonb;

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS trip_billing_source text
    CHECK (trip_billing_source IN ('account','saved','custom')),
  ADD COLUMN IF NOT EXISTS trip_billing_first_name text,
  ADD COLUMN IF NOT EXISTS trip_billing_last_name text,
  ADD COLUMN IF NOT EXISTS trip_billing_email text,
  ADD COLUMN IF NOT EXISTS trip_billing_phone text;
