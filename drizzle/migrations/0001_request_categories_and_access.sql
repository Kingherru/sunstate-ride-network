-- 1. Workspace attribution (nullable; existing rows untouched)
ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_instructions text,
  ADD COLUMN IF NOT EXISTS submitted_via text NOT NULL DEFAULT 'public_form';
CREATE INDEX IF NOT EXISTS ride_requests_workspace_id_idx ON public.ride_requests(workspace_id);

COMMENT ON COLUMN public.ride_requests.trip_kind IS 'Request category: passenger (Passenger Transportation) or medical_delivery (Medical Delivery). Existing rows default to passenger.';
COMMENT ON COLUMN public.ride_requests.patient_first_name IS 'Passenger first name; for medical_delivery rows holds the requester contact first name.';
COMMENT ON COLUMN public.ride_requests.patient_last_name IS 'Passenger last name; for medical_delivery rows holds the requester contact last name.';
COMMENT ON COLUMN public.ride_requests.patient_phone IS 'Passenger phone; for medical_delivery rows holds the requester contact phone.';
COMMENT ON COLUMN public.ride_requests.is_black_tie IS 'DEPRECATED: Black Tie service removed from the public form; retained for later cleanup.';
COMMENT ON COLUMN public.ride_requests.black_tie_vehicle IS 'DEPRECATED: Black Tie service removed; retained for later cleanup.';
COMMENT ON COLUMN public.ride_requests.black_tie_quote_status IS 'DEPRECATED: Black Tie service removed; retained for later cleanup.';
COMMENT ON COLUMN public.ride_requests.black_tie_quote_cents IS 'DEPRECATED: Black Tie service removed; retained for later cleanup.';
COMMENT ON COLUMN public.ride_requests.black_tie_quote_notes IS 'DEPRECATED: Black Tie service removed; retained for later cleanup.';

-- 2. Allow 'delivery' as transport_type for medical_delivery rows (widening only)
ALTER TABLE public.ride_requests DROP CONSTRAINT ride_requests_transport_type_check;
ALTER TABLE public.ride_requests ADD CONSTRAINT ride_requests_transport_type_check
  CHECK (transport_type = ANY (ARRAY['ambulatory','wheelchair','gurney','delivery']));

-- 3. Category consistency trigger (checked on insert or when category changes)
CREATE OR REPLACE FUNCTION public.ride_requests_validate_category()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.trip_kind IS NOT DISTINCT FROM OLD.trip_kind
     AND NEW.transport_type IS NOT DISTINCT FROM OLD.transport_type THEN
    RETURN NEW;
  END IF;
  IF NEW.trip_kind = 'medical_delivery' THEN
    IF NEW.transport_type <> 'delivery' THEN
      RAISE EXCEPTION 'Medical delivery requests must use the delivery service type' USING ERRCODE = '23514';
    END IF;
    IF NEW.mobility_notes IS NOT NULL OR NEW.diagnosis_code IS NOT NULL OR NEW.medicaid_number IS NOT NULL
       OR NEW.patient_date_of_birth IS NOT NULL OR NEW.round_trip OR NEW.recurrence_rule IS NOT NULL THEN
      RAISE EXCEPTION 'Passenger-only fields are not allowed on medical delivery requests' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.transport_type = 'delivery' OR NEW.delivery_item_type IS NOT NULL OR NEW.delivery_instructions IS NOT NULL THEN
      RAISE EXCEPTION 'Delivery fields are not allowed on passenger requests' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ride_requests_validate_category ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_validate_category
  BEFORE INSERT OR UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.ride_requests_validate_category();

-- 4. Workspace access helper: owners/admins of an active workspace only
CREATE OR REPLACE FUNCTION public.can_manage_workspace_requests(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _workspace_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members m
    JOIN public.workspaces w ON w.id = m.workspace_id
    WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id
      AND m.role IN ('owner','admin') AND w.status = 'active'
  )
$$;
REVOKE ALL ON FUNCTION public.can_manage_workspace_requests(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace_requests(uuid, uuid) TO authenticated;

-- 5. RLS hardening
DROP POLICY IF EXISTS "Anyone can submit a ride request" ON public.ride_requests;
DROP POLICY IF EXISTS "Providers can claim unassigned ride requests" ON public.ride_requests;
CREATE POLICY "Workspace owners and admins can view workspace requests"
  ON public.ride_requests FOR SELECT TO authenticated
  USING (public.can_manage_workspace_requests(auth.uid(), workspace_id));

REVOKE ALL ON public.ride_requests FROM anon;
REVOKE INSERT ON public.ride_requests FROM authenticated;
GRANT ALL ON public.ride_requests TO service_role;

-- Providers may no longer browse the open request pool
REVOKE EXECUTE ON FUNCTION public.list_open_ride_requests() FROM PUBLIC, anon, authenticated;