-- Vehicles: assigned driver + insurance document
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurance_doc_path text,
  ADD COLUMN IF NOT EXISTS insurance_expiry date;
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_driver ON public.vehicles(assigned_driver_id);

-- Facility ratings/feedback editable: add updated_at trigger if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_provider_ratings_updated_at'
  ) THEN
    CREATE TRIGGER set_provider_ratings_updated_at
      BEFORE UPDATE ON public.provider_ratings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;