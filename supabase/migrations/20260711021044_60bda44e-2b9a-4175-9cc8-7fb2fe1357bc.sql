ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS is_black_tie boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS black_tie_vehicle text,
  ADD COLUMN IF NOT EXISTS black_tie_quote_status text NOT NULL DEFAULT 'awaiting_quote',
  ADD COLUMN IF NOT EXISTS black_tie_quote_cents integer,
  ADD COLUMN IF NOT EXISTS black_tie_quote_notes text;

ALTER TABLE public.ride_requests
  DROP CONSTRAINT IF EXISTS ride_requests_black_tie_vehicle_check;
ALTER TABLE public.ride_requests
  ADD CONSTRAINT ride_requests_black_tie_vehicle_check CHECK (
    black_tie_vehicle IS NULL OR black_tie_vehicle IN (
      'black_suv','executive_sedan','luxury_sprinter_van','executive_shuttle_van',
      'party_bus','mini_coach','motor_coach','charter_bus','limousine'
    )
  );

ALTER TABLE public.ride_requests
  DROP CONSTRAINT IF EXISTS ride_requests_black_tie_quote_status_check;
ALTER TABLE public.ride_requests
  ADD CONSTRAINT ride_requests_black_tie_quote_status_check CHECK (
    black_tie_quote_status IN ('awaiting_quote','quote_sent','quote_accepted','quote_declined')
  );