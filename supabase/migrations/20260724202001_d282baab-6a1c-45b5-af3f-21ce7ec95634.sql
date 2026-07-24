-- 1) Add missing columns to trips so ride_request fields have a home
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS additional_stops jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS distance_miles numeric,
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS recurrence_exceptions jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Rewrite promote_ride_request_to_trip to carry every applicable field
CREATE OR REPLACE FUNCTION public.promote_ride_request_to_trip(_ride_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.ride_requests;
  v_trip_id uuid;
BEGIN
  SELECT * INTO r FROM public.ride_requests WHERE id = _ride_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride request % not found', _ride_request_id; END IF;

  INSERT INTO public.trips (
    created_by, region, status, source, ride_request_id,
    patient_first_name, patient_last_name, patient_phone, patient_email, patient_date_of_birth,
    pickup_address, pickup_city, pickup_zip, pickup_date, pickup_time, pickup_address_details,
    pickup_lat, pickup_lng,
    appointment_time, return_pickup_time, return_dropoff_time, return_date,
    dropoff_address, dropoff_city, dropoff_zip, dropoff_lat, dropoff_lng,
    transport_type, round_trip, mobility_notes, special_instructions,
    payer, payer_id, medicaid_number, medicaid_plan,
    service_level, needs_wheelchair, has_passenger,
    needs_assistance_to_vehicle, needs_surgery_signin, needs_surgery_signout,
    authorization_number, diagnosis_code,
    trip_kind,
    delivery_item_type, delivery_item_description, delivery_weight_lbs,
    delivery_temperature_sensitive, delivery_hazmat, delivery_signature_required,
    delivery_rush, delivery_recipient_name, delivery_recipient_phone,
    additional_stops, distance_miles,
    recurrence_rule, recurrence_end_date, recurrence_exceptions,
    estimated_cost_cents, estimated_duration_seconds, estimated_duration_traffic_seconds,
    route_polyline, route_computed_at,
    hipaa_ack_id, cancel_reason,
    emergency_contact_name, emergency_contact_phone
  ) VALUES (
    r.requester_user_id, NULL, 'open', 'manual', r.id,
    r.patient_first_name, r.patient_last_name, r.patient_phone, r.patient_email, r.patient_date_of_birth,
    r.pickup_address, r.pickup_city, r.pickup_zip, r.pickup_date, r.pickup_time, r.pickup_address_details,
    r.pickup_lat, r.pickup_lng,
    NULLIF(r.appointment_time,'')::time,
    NULLIF(r.return_pickup_time,'')::time,
    NULLIF(r.return_dropoff_time,'')::time,
    r.return_date,
    r.dropoff_address, r.dropoff_city, r.dropoff_zip, r.dropoff_lat, r.dropoff_lng,
    r.transport_type, r.round_trip, r.mobility_notes, r.special_instructions,
    r.payer, r.payer_id, r.medicaid_number, r.medicaid_plan,
    r.service_level, COALESCE(r.needs_wheelchair,false), COALESCE(r.has_passenger,false),
    COALESCE(r.needs_assistance_to_vehicle,false), COALESCE(r.needs_surgery_signin,false), COALESCE(r.needs_surgery_signout,false),
    r.authorization_number, r.diagnosis_code,
    COALESCE(r.trip_kind, 'passenger'::public.trip_kind),
    r.delivery_item_type, r.delivery_item_description, r.delivery_weight_lbs,
    COALESCE(r.delivery_temperature_sensitive,false), COALESCE(r.delivery_hazmat,false), COALESCE(r.delivery_signature_required,false),
    COALESCE(r.delivery_rush,false), r.delivery_recipient_name, r.delivery_recipient_phone,
    COALESCE(r.additional_stops, '[]'::jsonb), r.distance_miles,
    r.recurrence_rule, r.recurrence_end_date, COALESCE(r.recurrence_exceptions, '[]'::jsonb),
    r.estimated_cost_cents, r.estimated_duration_seconds, r.estimated_duration_traffic_seconds,
    r.route_polyline, r.route_computed_at,
    r.hipaa_ack_id, r.cancel_reason,
    -- Public requesters don't fill an emergency contact block; fall back to the
    -- requester's own contact info so the provider still has someone to call.
    NULLIF(TRIM(CONCAT_WS(' ', r.patient_first_name, r.patient_last_name)), ''),
    COALESCE(r.requester_phone, r.patient_phone)
  ) RETURNING id INTO v_trip_id;

  UPDATE public.ride_requests SET promoted_trip_id = v_trip_id, promoted_at = now() WHERE id = _ride_request_id;
  RETURN v_trip_id;
END;
$function$;