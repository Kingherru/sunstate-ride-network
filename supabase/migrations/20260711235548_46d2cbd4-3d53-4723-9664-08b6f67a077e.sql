
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS market_pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS medicaid_pricing jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed reasonable Florida averages + Medicaid managed-care rates if empty.
UPDATE public.platform_settings SET
  market_pricing = jsonb_build_object(
    'ambulatory_base', 30, 'ambulatory_per_mile', 3.00,
    'wheelchair_base', 50, 'wheelchair_per_mile', 3.50,
    'stretcher_base', 175, 'stretcher_per_mile', 5.00,
    'wait_per_hour', 45, 'no_show', 25, 'cancellation', 15,
    'after_hours_addon', 20, 'holiday_surcharge', 25,
    'additional_passenger', 5, 'minimum_fare', 25
  )
WHERE market_pricing = '{}'::jsonb;

UPDATE public.platform_settings SET
  medicaid_pricing = jsonb_build_object(
    'ambulatory_base', 12.50, 'ambulatory_per_mile', 1.60,
    'wheelchair_base', 22.00, 'wheelchair_per_mile', 2.30,
    'stretcher_base', 110.00, 'stretcher_per_mile', 4.25,
    'wait_per_hour', 18, 'no_show', 12, 'cancellation', 0,
    'after_hours_addon', 10, 'holiday_surcharge', 15,
    'additional_passenger', 0, 'minimum_fare', 12.50
  )
WHERE medicaid_pricing = '{}'::jsonb;

-- If no row exists yet, create one with the defaults.
INSERT INTO public.platform_settings (id, platform_fee_pct, market_pricing, medicaid_pricing)
SELECT true, 0.10,
  jsonb_build_object(
    'ambulatory_base', 30, 'ambulatory_per_mile', 3.00,
    'wheelchair_base', 50, 'wheelchair_per_mile', 3.50,
    'stretcher_base', 175, 'stretcher_per_mile', 5.00,
    'wait_per_hour', 45, 'no_show', 25, 'cancellation', 15,
    'after_hours_addon', 20, 'holiday_surcharge', 25,
    'additional_passenger', 5, 'minimum_fare', 25
  ),
  jsonb_build_object(
    'ambulatory_base', 12.50, 'ambulatory_per_mile', 1.60,
    'wheelchair_base', 22.00, 'wheelchair_per_mile', 2.30,
    'stretcher_base', 110.00, 'stretcher_per_mile', 4.25,
    'wait_per_hour', 18, 'no_show', 12, 'cancellation', 0,
    'after_hours_addon', 10, 'holiday_surcharge', 15,
    'additional_passenger', 0, 'minimum_fare', 12.50
  )
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);
