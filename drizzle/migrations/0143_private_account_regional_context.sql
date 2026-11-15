ALTER TABLE public.provider_contacts ADD COLUMN county_equivalent text, ADD COLUMN timezone text;
ALTER TABLE public.saved_patients ADD COLUMN county_equivalent text, ADD COLUMN timezone text;
ALTER TABLE public.payers ADD COLUMN billing_state text, ADD COLUMN billing_zip text, ADD COLUMN billing_county text, ADD COLUMN billing_timezone text;
ALTER TABLE public.drivers ADD COLUMN regional_service_areas jsonb;
COMMENT ON COLUMN public.drivers.regional_service_areas IS 'Optional provider-entered boundaries for preparation only; does not authorize or automatically assign trips.';
COMMENT ON COLUMN public.saved_patients.timezone IS 'Explicit selected timezone; NULL legacy values remain unknown, never inferred from addresses.';