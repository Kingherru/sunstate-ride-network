
-- 1. Link trips back to originating ride_requests
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS ride_request_id uuid REFERENCES public.ride_requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS trips_ride_request_id_idx ON public.trips(ride_request_id);

-- 2. Promote ride_request -> trip
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
    COALESCE(r.requester_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
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
    r.appointment_time, r.return_pickup_time, r.return_dropoff_time,
    r.hipaa_ack_id, 'ride_request', v_zone, r.id,
    COALESCE(r.payment_status, 'unpaid')
  ) RETURNING id INTO v_trip_id;

  RETURN v_trip_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_promote_ride_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.promote_ride_request_to_trip(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ride_requests_promote ON public.ride_requests;
CREATE TRIGGER trg_ride_requests_promote
  AFTER INSERT ON public.ride_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_promote_ride_request();

-- 3. Notify dispatch on new trip
CREATE OR REPLACE FUNCTION public.notify_dispatch_on_new_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id FROM public.user_roles
     WHERE role IN ('admin','app_manager','dispatcher')
    UNION
    SELECT DISTINCT zma.user_id FROM public.zone_manager_assignments zma
     WHERE NEW.dispatch_zone_id IS NOT NULL AND zma.zone_id = NEW.dispatch_zone_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'trip_new',
            'New trip in dispatch queue',
            'Trip ' || COALESCE(NEW.display_id, NEW.id::text) ||
              ' on ' || NEW.pickup_date || ' at ' || NEW.pickup_time || ' needs assignment.',
            '/admin?tab=dispatch');
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_trips_notify_dispatch ON public.trips;
CREATE TRIGGER trg_trips_notify_dispatch
  AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.notify_dispatch_on_new_trip();

-- 4. Trip quotes
CREATE TABLE IF NOT EXISTS public.trip_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  provider_user_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_quotes_trip_idx ON public.trip_quotes(trip_id);
CREATE INDEX IF NOT EXISTS trip_quotes_provider_idx ON public.trip_quotes(provider_user_id);

GRANT SELECT, INSERT, UPDATE ON public.trip_quotes TO authenticated;
GRANT ALL ON public.trip_quotes TO service_role;

ALTER TABLE public.trip_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers create own quotes"
  ON public.trip_quotes FOR INSERT TO authenticated
  WITH CHECK (provider_user_id = auth.uid());

CREATE POLICY "Providers view own quotes"
  ON public.trip_quotes FOR SELECT TO authenticated
  USING (provider_user_id = auth.uid());

CREATE POLICY "Ops staff view all quotes"
  ON public.trip_quotes FOR SELECT TO authenticated
  USING (public.is_ops_staff(auth.uid()));

CREATE POLICY "Ops staff update quotes"
  ON public.trip_quotes FOR UPDATE TO authenticated
  USING (public.is_ops_staff(auth.uid()))
  WITH CHECK (public.is_ops_staff(auth.uid()));

CREATE POLICY "Requester views approved quotes"
  ON public.trip_quotes FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_quotes.trip_id AND t.created_by = auth.uid())
  );

CREATE TRIGGER trg_trip_quotes_updated_at BEFORE UPDATE ON public.trip_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Provider actions
CREATE OR REPLACE FUNCTION public.accept_trip(_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t record; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.assigned_to IS NOT NULL AND t.assigned_to <> auth.uid() THEN
    RAISE EXCEPTION 'Trip already assigned';
  END IF;

  UPDATE public.trips SET assigned_to = auth.uid(), status = 'assigned' WHERE id = _trip_id;

  -- Notify requester
  IF t.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (t.created_by, 'trip_accepted', 'A provider accepted your trip',
            'Trip ' || COALESCE(t.display_id, t.id::text) || ' has been accepted.',
            '/dashboard');
  END IF;
  -- Notify dispatch
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','app_manager','dispatcher') LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'trip_accepted', 'Provider accepted a trip',
            'Trip ' || COALESCE(t.display_id, t.id::text) || ' was accepted by a provider.',
            '/admin?tab=dispatch');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.decline_trip(_trip_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t record; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;

  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','app_manager','dispatcher') LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'trip_declined', 'Provider declined a trip',
            'Trip ' || COALESCE(t.display_id, t.id::text) || ' was declined by a provider' ||
              COALESCE(': ' || _reason, '') || '.',
            '/admin?tab=dispatch');
  END LOOP;

  PERFORM public.log_staff_action('trip_declined', 'trip', _trip_id::text,
    jsonb_build_object('provider_user_id', auth.uid(), 'reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.submit_trip_quote(_trip_id uuid, _amount_cents integer, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; r record; t record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;

  INSERT INTO public.trip_quotes (trip_id, provider_user_id, amount_cents, note)
    VALUES (_trip_id, auth.uid(), _amount_cents, _note)
    RETURNING id INTO v_id;

  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','app_manager','dispatcher') LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'trip_quote_submitted', 'New provider quote',
            'A provider submitted a quote of $' || (_amount_cents::numeric/100)::text ||
              ' for trip ' || COALESCE(t.display_id, t.id::text) || '.',
            '/admin?tab=dispatch');
  END LOOP;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.decide_trip_quote(_quote_id uuid, _approve boolean, _decision_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE q record; t record;
BEGIN
  IF NOT public.is_ops_staff(auth.uid()) THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT * INTO q FROM public.trip_quotes WHERE id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
  SELECT * INTO t FROM public.trips WHERE id = q.trip_id;

  UPDATE public.trip_quotes
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         decided_by = auth.uid(), decided_at = now(), decision_note = _decision_note
   WHERE id = _quote_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (q.provider_user_id,
          CASE WHEN _approve THEN 'trip_quote_approved' ELSE 'trip_quote_rejected' END,
          CASE WHEN _approve THEN 'Your quote was approved' ELSE 'Your quote was rejected' END,
          'Trip ' || COALESCE(t.display_id, t.id::text) || ' quote decision.' ||
            COALESCE(' Note: ' || _decision_note, ''),
          '/provider/dashboard?tab=requests');

  IF _approve AND t.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (t.created_by, 'trip_quote_approved',
            'A quote is available for your trip',
            'A quote of $' || (q.amount_cents::numeric/100)::text ||
              ' was approved for trip ' || COALESCE(t.display_id, t.id::text) || '.',
            '/dashboard');
  END IF;
END $$;

-- 6. Notify on payment status change
CREATE OR REPLACE FUNCTION public.notify_on_trip_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN RETURN NEW; END IF;

  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.assigned_to, 'trip_payment_status',
            'Trip payment: ' || NEW.payment_status,
            'Payment status changed to ' || NEW.payment_status || ' for trip ' ||
              COALESCE(NEW.display_id, NEW.id::text) || '.',
            '/provider/dashboard');
  END IF;
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','app_manager','dispatcher') LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'trip_payment_status',
            'Trip payment: ' || NEW.payment_status,
            'Trip ' || COALESCE(NEW.display_id, NEW.id::text) ||
              ' payment is now ' || NEW.payment_status || '.',
            '/admin?tab=dispatch');
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_trips_payment_notify ON public.trips;
CREATE TRIGGER trg_trips_payment_notify
  AFTER UPDATE OF payment_status ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_trip_payment_status();

-- 7. Start staff thread
CREATE OR REPLACE FUNCTION public.start_staff_thread()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin uuid;
  v_thread uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Pick an ops staff recipient: prefer admin, then dispatcher
  SELECT ur.user_id INTO v_admin
    FROM public.user_roles ur
   WHERE ur.role = 'admin'
   ORDER BY ur.user_id
   LIMIT 1;
  IF v_admin IS NULL THEN
    SELECT ur.user_id INTO v_admin FROM public.user_roles ur
     WHERE ur.role IN ('app_manager','dispatcher','staff','zone_manager')
     ORDER BY ur.user_id LIMIT 1;
  END IF;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'No staff available'; END IF;

  RETURN public.start_direct_thread(v_admin);
END $$;
