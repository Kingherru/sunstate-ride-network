
-- =========================
-- 1) Trip Display IDs (FLN-000123)
-- =========================
CREATE SEQUENCE IF NOT EXISTS public.trip_display_seq START 1;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS display_id text UNIQUE;

CREATE OR REPLACE FUNCTION public.set_trip_display_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_id IS NULL OR NEW.display_id = '' THEN
    NEW.display_id := 'FLN-' || lpad(nextval('public.trip_display_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_trips_display_id ON public.trips;
CREATE TRIGGER trg_trips_display_id
  BEFORE INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_trip_display_id();

-- Backfill existing rows
UPDATE public.trips
   SET display_id = 'FLN-' || lpad(nextval('public.trip_display_seq')::text, 6, '0')
 WHERE display_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_trips_display_id ON public.trips (display_id);

-- =========================
-- 2) Dispatch Zones
-- =========================
CREATE TABLE IF NOT EXISTS public.dispatch_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dispatch_zones TO authenticated, anon;
GRANT ALL ON public.dispatch_zones TO service_role;
ALTER TABLE public.dispatch_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zones readable by all"
  ON public.dispatch_zones FOR SELECT
  USING (true);

CREATE POLICY "zones admin write"
  ON public.dispatch_zones FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.dispatch_zones (code, name, sort_order) VALUES
  ('PANHANDLE', 'Panhandle', 1),
  ('NORTH',     'North',     2),
  ('CENTRAL',   'Central',   3),
  ('SOUTHWEST', 'Southwest', 4),
  ('SOUTHEAST', 'Southeast', 5)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.dispatch_zone_zips (
  zip text PRIMARY KEY,
  zone_id uuid NOT NULL REFERENCES public.dispatch_zones(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dispatch_zone_zips TO authenticated, anon;
GRANT ALL ON public.dispatch_zone_zips TO service_role;
ALTER TABLE public.dispatch_zone_zips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zone_zips readable by all"
  ON public.dispatch_zone_zips FOR SELECT
  USING (true);

CREATE POLICY "zone_zips admin write"
  ON public.dispatch_zone_zips FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_zone_zips_zone ON public.dispatch_zone_zips (zone_id);

-- =========================
-- 3) Trip → dispatch zone (auto-route by pickup ZIP)
-- =========================
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS dispatch_zone_id uuid REFERENCES public.dispatch_zones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_dispatch_zone ON public.trips (dispatch_zone_id);

CREATE OR REPLACE FUNCTION public.assign_trip_dispatch_zone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_zone uuid;
BEGIN
  IF NEW.dispatch_zone_id IS NULL AND NEW.pickup_zip IS NOT NULL THEN
    SELECT zone_id INTO v_zone
      FROM public.dispatch_zone_zips
     WHERE zip = substring(regexp_replace(NEW.pickup_zip, '\D', '', 'g') FROM 1 FOR 5);
    IF v_zone IS NOT NULL THEN
      NEW.dispatch_zone_id := v_zone;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_trips_dispatch_zone ON public.trips;
CREATE TRIGGER trg_trips_dispatch_zone
  BEFORE INSERT OR UPDATE OF pickup_zip ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.assign_trip_dispatch_zone();

-- Backfill zones for existing trips
UPDATE public.trips t
   SET dispatch_zone_id = z.zone_id
  FROM public.dispatch_zone_zips z
 WHERE z.zip = substring(regexp_replace(t.pickup_zip, '\D', '', 'g') FROM 1 FOR 5)
   AND t.dispatch_zone_id IS NULL
   AND t.pickup_zip IS NOT NULL;

-- =========================
-- 4) Provider Weekly Schedule Entries
-- =========================
CREATE TABLE IF NOT EXISTS public.provider_schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  pickup_date date NOT NULL,
  pickup_time time NOT NULL,
  dropoff_time time,
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  round_trip boolean NOT NULL DEFAULT false,
  passenger_first_name text NOT NULL,
  passenger_last_name text NOT NULL,
  passenger_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_schedule_entries TO authenticated;
GRANT ALL ON public.provider_schedule_entries TO service_role;
ALTER TABLE public.provider_schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule owner manage"
  ON public.provider_schedule_entries FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "schedule admin read"
  ON public.provider_schedule_entries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_schedule_owner_week ON public.provider_schedule_entries (owner_id, week_start);
CREATE INDEX IF NOT EXISTS idx_schedule_pickup_date ON public.provider_schedule_entries (pickup_date);

CREATE TRIGGER trg_schedule_updated
  BEFORE UPDATE ON public.provider_schedule_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_zones_updated
  BEFORE UPDATE ON public.dispatch_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_zone_zips_updated
  BEFORE UPDATE ON public.dispatch_zone_zips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
