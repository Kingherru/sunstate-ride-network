
-- drivers
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  email text,
  license_number text,
  license_expiry date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','on_leave')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their drivers" ON public.drivers FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_drivers_owner ON public.drivers(owner_id);
CREATE TRIGGER set_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- vehicles
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  plate text,
  vehicle_type text NOT NULL DEFAULT 'sedan' CHECK (vehicle_type IN ('sedan','suv','van','wheelchair_van','stretcher_van','ambulance')),
  capacity int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','maintenance')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_vehicles_owner ON public.vehicles(owner_id);
CREATE TRIGGER set_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- provider_pricing
CREATE TABLE public.provider_pricing (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  base_pickup numeric(10,2) NOT NULL DEFAULT 0,
  per_mile numeric(10,2) NOT NULL DEFAULT 0,
  wait_per_min numeric(10,2) NOT NULL DEFAULT 0,
  no_show numeric(10,2) NOT NULL DEFAULT 0,
  cancellation numeric(10,2) NOT NULL DEFAULT 0,
  wheelchair_addon numeric(10,2) NOT NULL DEFAULT 0,
  stretcher_addon numeric(10,2) NOT NULL DEFAULT 0,
  after_hours_addon numeric(10,2) NOT NULL DEFAULT 0,
  holiday_surcharge numeric(10,2) NOT NULL DEFAULT 0,
  additional_passenger numeric(10,2) NOT NULL DEFAULT 0,
  minimum_fare numeric(10,2) NOT NULL DEFAULT 0,
  after_hours_start time NOT NULL DEFAULT '19:00',
  after_hours_end time NOT NULL DEFAULT '07:00',
  holidays date[] NOT NULL DEFAULT '{}',
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_pricing TO authenticated;
GRANT ALL ON public.provider_pricing TO service_role;
ALTER TABLE public.provider_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their pricing" ON public.provider_pricing FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER set_provider_pricing_updated_at BEFORE UPDATE ON public.provider_pricing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trip operational fields
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_dropoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_dropoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_miles numeric(10,2),
  ADD COLUMN IF NOT EXISTS actual_miles numeric(10,2),
  ADD COLUMN IF NOT EXISTS wait_minutes int,
  ADD COLUMN IF NOT EXISTS additional_passengers int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS no_show_reason text,
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS cost_total numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_trips_driver ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON public.trips(vehicle_id);
