
-- 1) Replace the overly permissive creator UPDATE policy with a workflow-scoped one.
DROP POLICY IF EXISTS "Trip creators can update non-financial trips" ON public.trips;

CREATE POLICY "Trip creators can update pre-dispatch trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  AND assigned_to IS NULL
  AND status = 'open'
)
WITH CHECK (
  auth.uid() = created_by
  AND assigned_to IS NULL
  AND status = 'open'
);

-- 2) Field-level guard: block non-staff from mutating workflow/system fields.
--    Complements RLS by preventing creators from changing assignment, driver,
--    vehicle, dispatch zone, status, region, source, HIPAA ack, or completed_at;
--    and restricts assigned providers to workflow-only fields.
CREATE OR REPLACE FUNCTION public.trips_enforce_field_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text;
  v_uid uuid;
  v_is_staff boolean := false;
BEGIN
  IF v_claims IS NULL THEN
    -- No JWT context (server-side/service_role/triggered) — allow.
    RETURN NEW;
  END IF;

  v_role := (v_claims::jsonb ->> 'role');
  BEGIN v_uid := ((v_claims::jsonb ->> 'sub'))::uuid; EXCEPTION WHEN OTHERS THEN v_uid := NULL; END;

  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL THEN
    v_is_staff := public.has_any_role(
      v_uid,
      ARRAY['admin'::app_role, 'app_manager'::app_role, 'dispatcher'::app_role, 'zone_manager'::app_role, 'staff'::app_role]
    );
  END IF;

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  -- Assigned provider path: only workflow fields may change.
  IF v_uid IS NOT NULL AND v_uid = OLD.assigned_to THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.dispatch_zone_id IS DISTINCT FROM OLD.dispatch_zone_id
       OR NEW.region IS DISTINCT FROM OLD.region
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.hipaa_ack_id IS DISTINCT FROM OLD.hipaa_ack_id
       OR NEW.patient_first_name IS DISTINCT FROM OLD.patient_first_name
       OR NEW.patient_last_name IS DISTINCT FROM OLD.patient_last_name
       OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
       OR NEW.pickup_city IS DISTINCT FROM OLD.pickup_city
       OR NEW.pickup_zip IS DISTINCT FROM OLD.pickup_zip
       OR NEW.pickup_date IS DISTINCT FROM OLD.pickup_date
       OR NEW.pickup_time IS DISTINCT FROM OLD.pickup_time
       OR NEW.dropoff_address IS DISTINCT FROM OLD.dropoff_address
       OR NEW.dropoff_city IS DISTINCT FROM OLD.dropoff_city
       OR NEW.dropoff_zip IS DISTINCT FROM OLD.dropoff_zip
    THEN
      RAISE EXCEPTION 'Assigned providers can only update workflow fields (status, driver, vehicle, notes, timestamps).'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- Creator path: block workflow/system fields regardless of RLS.
  IF v_uid IS NOT NULL AND v_uid = OLD.created_by THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
       OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
       OR NEW.dispatch_zone_id IS DISTINCT FROM OLD.dispatch_zone_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.region IS DISTINCT FROM OLD.region
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.hipaa_ack_id IS DISTINCT FROM OLD.hipaa_ack_id
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
    THEN
      RAISE EXCEPTION 'Trip creators cannot modify workflow or system fields (assignment, driver, vehicle, status, zone, region, source).'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.trips_enforce_field_authorization() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trips_enforce_field_authorization ON public.trips;
CREATE TRIGGER trg_trips_enforce_field_authorization
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.trips_enforce_field_authorization();
