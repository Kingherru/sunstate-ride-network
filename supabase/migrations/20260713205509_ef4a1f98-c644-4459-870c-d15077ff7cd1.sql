CREATE OR REPLACE FUNCTION public.promote_ride_request_to_trip(_ride_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ride_requests%ROWTYPE;
  v_trip_id uuid;
  v_zone uuid;
BEGIN
  SELECT * INTO r FROM public.ride_requests WHERE id = _ride_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ride_request % not found', _ride_request_id; END IF;

  -- Idempotent
  SELECT id INTO v_trip_id FROM public.trips WHERE ride_request_id = _ride_request_id LIMIT 1;
  IF v_trip_id IS NOT NULL THEN RETURN v_trip_id; END IF;

  v_zone := public.zone_id_for_zip(r.pickup_zip);

  INSERT INTO public.trips (
    created_by, assigned_to, status,
    patient_first_name, patient_last_name, patient_phone, patient_date_of_birth,
    pickup_address, pickup_address_details, pickup_city, pickup_zip,
    pickup_date, pickup_time,
    dropoff_address, dropoff_city, dropoff_zip,
    transport_type, round_trip, mobility_notes, special_instructions,
    payer, medicaid_number, medicaid_plan, authorization_number, diagnosis_code,
    service_level, needs_wheelchair, has_passenger,
    needs_assistance_to_vehicle, needs_surgery_signin, needs_surgery_signout,
    appointment_time, return_pickup_time, return_dropoff_time,
    hipaa_ack_id, source, dispatch_zone_id, ride_request_id,
    payment_status
  ) VALUES (
    r.requester_user_id,
    r.assigned_provider_id,
    CASE WHEN r.assigned_provider_id IS NOT NULL THEN 'assigned' ELSE 'open' END,
    r.patient_first_name, r.patient_last_name, r.patient_phone, r.patient_date_of_birth,
    r.pickup_address, r.pickup_address_details, r.pickup_city, r.pickup_zip,
    r.pickup_date, r.pickup_time,
    r.dropoff_address, r.dropoff_city, r.dropoff_zip,
    r.transport_type, r.round_trip, r.mobility_notes, r.special_instructions,
    r.payer, r.medicaid_number, r.medicaid_plan, r.authorization_number, r.diagnosis_code,
    r.service_level, COALESCE(r.needs_wheelchair,false), COALESCE(r.has_passenger,false),
    COALESCE(r.needs_assistance_to_vehicle,false), COALESCE(r.needs_surgery_signin,false), COALESCE(r.needs_surgery_signout,false),
    NULLIF(r.appointment_time, '')::time,
    NULLIF(r.return_pickup_time, '')::time,
    NULLIF(r.return_dropoff_time, '')::time,
    r.hipaa_ack_id, 'ride_request', v_zone, r.id,
    COALESCE(r.payment_status, 'unpaid')
  ) RETURNING id INTO v_trip_id;

  RETURN v_trip_id;
END $$;