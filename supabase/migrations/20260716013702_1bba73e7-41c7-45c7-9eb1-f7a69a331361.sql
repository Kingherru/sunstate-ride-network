
DO $$ BEGIN
  CREATE TYPE public.trip_kind AS ENUM ('passenger', 'medical_delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_item_type AS ENUM (
    'prescription', 'lab_sample', 'medical_supplies', 'equipment', 'dme', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_kind public.trip_kind NOT NULL DEFAULT 'passenger',
  ADD COLUMN IF NOT EXISTS delivery_item_type public.delivery_item_type,
  ADD COLUMN IF NOT EXISTS delivery_item_description text,
  ADD COLUMN IF NOT EXISTS delivery_weight_lbs numeric(10,2),
  ADD COLUMN IF NOT EXISTS delivery_temperature_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_hazmat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_signature_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_rush boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_recipient_name text,
  ADD COLUMN IF NOT EXISTS delivery_recipient_phone text,
  ADD COLUMN IF NOT EXISTS delivery_proof_url text;

CREATE INDEX IF NOT EXISTS trips_trip_kind_idx ON public.trips(trip_kind);

ALTER TABLE public.ride_requests
  ADD COLUMN IF NOT EXISTS trip_kind public.trip_kind NOT NULL DEFAULT 'passenger',
  ADD COLUMN IF NOT EXISTS delivery_item_type public.delivery_item_type,
  ADD COLUMN IF NOT EXISTS delivery_item_description text,
  ADD COLUMN IF NOT EXISTS delivery_weight_lbs numeric(10,2),
  ADD COLUMN IF NOT EXISTS delivery_temperature_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_hazmat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_signature_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_rush boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_recipient_name text,
  ADD COLUMN IF NOT EXISTS delivery_recipient_phone text;

ALTER TABLE public.provider_pricing
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_base numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_per_mile numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_wait_per_unit numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_min_fee numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_cold_chain_surcharge numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_signature_surcharge numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_rush_surcharge numeric(10,2) NOT NULL DEFAULT 0;

-- Drop the existing overload before recreating (parameter name changed)
DROP FUNCTION IF EXISTS public.promote_ride_request_to_trip(uuid);

CREATE FUNCTION public.promote_ride_request_to_trip(_ride_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.ride_requests;
  v_trip_id uuid;
BEGIN
  SELECT * INTO r FROM public.ride_requests WHERE id = _ride_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ride request % not found', _ride_request_id; END IF;

  INSERT INTO public.trips (
    created_by, region, status, source,
    patient_first_name, patient_last_name, patient_phone, patient_date_of_birth,
    pickup_address, pickup_city, pickup_zip, pickup_date, pickup_time, pickup_address_details,
    appointment_time, return_pickup_time, return_dropoff_time,
    dropoff_address, dropoff_city, dropoff_zip,
    transport_type, round_trip, mobility_notes, special_instructions,
    payer, trip_number, medicaid_number, medicaid_plan,
    service_level, needs_wheelchair, has_passenger,
    needs_assistance_to_vehicle, needs_surgery_signin, needs_surgery_signout,
    authorization_number, diagnosis_code,
    emergency_contact_name, emergency_contact_phone,
    trip_kind,
    delivery_item_type, delivery_item_description, delivery_weight_lbs,
    delivery_temperature_sensitive, delivery_hazmat, delivery_signature_required,
    delivery_rush, delivery_recipient_name, delivery_recipient_phone
  ) VALUES (
    r.created_by, r.region, 'open', COALESCE(r.source, 'manual'),
    r.patient_first_name, r.patient_last_name, r.patient_phone, r.patient_date_of_birth,
    r.pickup_address, r.pickup_city, r.pickup_zip, r.pickup_date, r.pickup_time, r.pickup_address_details,
    r.appointment_time, r.return_pickup_time, r.return_dropoff_time,
    r.dropoff_address, r.dropoff_city, r.dropoff_zip,
    r.transport_type, r.round_trip, r.mobility_notes, r.special_instructions,
    r.payer, r.trip_number, r.medicaid_number, r.medicaid_plan,
    r.service_level, COALESCE(r.needs_wheelchair,false), COALESCE(r.has_passenger,false),
    COALESCE(r.needs_assistance_to_vehicle,false), COALESCE(r.needs_surgery_signin,false), COALESCE(r.needs_surgery_signout,false),
    r.authorization_number, r.diagnosis_code,
    r.emergency_contact_name, r.emergency_contact_phone,
    COALESCE(r.trip_kind, 'passenger'::public.trip_kind),
    r.delivery_item_type, r.delivery_item_description, r.delivery_weight_lbs,
    COALESCE(r.delivery_temperature_sensitive,false), COALESCE(r.delivery_hazmat,false), COALESCE(r.delivery_signature_required,false),
    COALESCE(r.delivery_rush,false), r.delivery_recipient_name, r.delivery_recipient_phone
  ) RETURNING id INTO v_trip_id;

  UPDATE public.ride_requests SET promoted_trip_id = v_trip_id, promoted_at = now() WHERE id = _ride_request_id;
  RETURN v_trip_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_ride_request_to_trip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_ride_request_to_trip(uuid) TO authenticated, service_role;

COMMENT ON COLUMN public.trips.trip_kind IS
  'Trip category. passenger = person transport; medical_delivery = non-emergency medical item delivery. Same status/quote/assignment/payout pipeline.';
COMMENT ON COLUMN public.provider_pricing.delivery_enabled IS
  'When true, provider offers Medical Delivery service and delivery_* columns price medical_delivery trips.';
