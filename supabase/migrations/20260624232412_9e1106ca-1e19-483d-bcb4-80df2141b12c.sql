
ALTER TABLE public.provider_pricing
  ADD COLUMN IF NOT EXISTS pay_base_pickup NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_per_mile NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_wait_per_min NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_no_show NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_cancellation NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_wheelchair_addon NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_stretcher_addon NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_after_hours_addon NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_holiday_surcharge NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pay_additional_passenger NUMERIC(10,2);
