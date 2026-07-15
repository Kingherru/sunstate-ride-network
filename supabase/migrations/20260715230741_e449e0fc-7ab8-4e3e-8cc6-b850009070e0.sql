ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS primary_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_primary_vehicle_id ON public.drivers(primary_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_driver_id ON public.vehicles(assigned_driver_id);