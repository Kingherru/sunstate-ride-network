
-- Change history for ride_requests
CREATE TABLE public.ride_request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
  changed_by uuid,
  changed_by_role text,
  changed_by_email text,
  action text NOT NULL DEFAULT 'update',
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ride_request_history_req_idx ON public.ride_request_history(ride_request_id, created_at DESC);

GRANT SELECT, INSERT ON public.ride_request_history TO authenticated;
GRANT ALL ON public.ride_request_history TO service_role;

ALTER TABLE public.ride_request_history ENABLE ROW LEVEL SECURITY;

-- Owners (requester), assigned provider, and ops staff can read history.
CREATE POLICY "History readable by requester, provider, or staff"
  ON public.ride_request_history
  FOR SELECT
  TO authenticated
  USING (
    public.is_ops_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.ride_requests r
      WHERE r.id = ride_request_history.ride_request_id
        AND (r.requester_user_id = auth.uid() OR r.assigned_provider_id = auth.uid())
    )
  );

-- Trigger: capture changes to notable fields on ride_requests updates
CREATE OR REPLACE FUNCTION public.log_ride_request_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_email text;
  v_changes jsonb := '{}'::jsonb;
  v_summary_parts text[] := ARRAY[]::text[];
  v_fields text[] := ARRAY[
    'status','pickup_date','pickup_time','pickup_address','pickup_address_details','pickup_city','pickup_zip',
    'dropoff_address','dropoff_city','dropoff_zip','appointment_time','return_pickup_time','return_dropoff_time',
    'trip_type','round_trip','transport_type','service_level','needs_wheelchair','has_passenger',
    'needs_assistance_to_vehicle','needs_surgery_signin','needs_surgery_signout','mobility_notes',
    'special_instructions','provider_notes','patient_first_name','patient_last_name','patient_phone',
    'patient_email','payer','medicaid_number','medicaid_plan','authorization_number','diagnosis_code',
    'assigned_provider_id','assigned_driver_id','estimated_cost_cents','payment_status','payment_amount_cents',
    'canceled_at','cancel_reason','additional_stops','recurrence_rule','recurrence_end_date'
  ];
  f text;
  old_v jsonb;
  new_v jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  FOREACH f IN ARRAY v_fields LOOP
    old_v := to_jsonb(OLD) -> f;
    new_v := to_jsonb(NEW) -> f;
    IF old_v IS DISTINCT FROM new_v THEN
      v_changes := v_changes || jsonb_build_object(f, jsonb_build_object('from', old_v, 'to', new_v));
      v_summary_parts := array_append(v_summary_parts, f);
    END IF;
  END LOOP;

  IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF;

  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
    IF public.is_ops_staff(v_actor) THEN
      v_role := 'staff';
    ELSIF NEW.assigned_provider_id = v_actor OR OLD.assigned_provider_id = v_actor THEN
      v_role := 'provider';
    ELSIF NEW.requester_user_id = v_actor THEN
      v_role := 'requester';
    ELSE
      v_role := 'user';
    END IF;
  ELSE
    v_role := 'system';
  END IF;

  INSERT INTO public.ride_request_history
    (ride_request_id, changed_by, changed_by_role, changed_by_email, action, changes, summary)
  VALUES
    (NEW.id, v_actor, v_role, v_email, 'update', v_changes,
     'Updated: ' || array_to_string(v_summary_parts, ', '));

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_ride_request_history
  AFTER UPDATE ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_ride_request_history();
