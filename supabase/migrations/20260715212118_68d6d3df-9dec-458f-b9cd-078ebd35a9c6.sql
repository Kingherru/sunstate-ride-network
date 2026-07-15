ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS service_capabilities text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS contractor_pricing jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS service_capabilities text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Validate capability values (ambulatory | wheelchair | stretcher)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_service_capabilities_check'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_service_capabilities_check
      CHECK (service_capabilities <@ ARRAY['ambulatory','wheelchair','stretcher']::text[]);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_service_capabilities_check'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_service_capabilities_check
      CHECK (service_capabilities <@ ARRAY['ambulatory','wheelchair','stretcher']::text[]);
  END IF;
END$$;
