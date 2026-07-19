ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_pay_type_check;
ALTER TABLE public.drivers ADD CONSTRAINT drivers_pay_type_check
  CHECK (pay_type IS NULL OR pay_type IN ('hourly','daily_salary','per_trip','per_pickup_leg','per_mile','hybrid','independent_contractor'));