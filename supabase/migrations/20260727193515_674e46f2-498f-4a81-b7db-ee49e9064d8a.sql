ALTER TABLE public.provider_pricing
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'recommended';

ALTER TABLE public.provider_pricing
  DROP CONSTRAINT IF EXISTS provider_pricing_pricing_mode_check;

ALTER TABLE public.provider_pricing
  ADD CONSTRAINT provider_pricing_pricing_mode_check
    CHECK (pricing_mode IN ('recommended','custom'));

UPDATE public.provider_pricing SET pricing_mode = 'recommended' WHERE pricing_mode IS NULL;