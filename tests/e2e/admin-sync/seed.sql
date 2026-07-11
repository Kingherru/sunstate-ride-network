-- Seeds one representative row per synced module for the Admin sync E2E.
-- Wrapped in a transaction so a failed run cleans up on rollback.
--
-- Requires an existing member_profiles row (any user) to satisfy FK targets.
-- Uses `now()` timestamps so the Admin sync widget must show them as "Fresh".

BEGIN;

-- Pick two existing users to play the roles of "creator" / "assignee".
CREATE TEMP TABLE _actors ON COMMIT DROP AS
SELECT user_id FROM public.member_profiles ORDER BY created_at LIMIT 2;

DO $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_marker text := 'e2e_sync_' || to_char(now(), 'YYYYMMDDHH24MISS');
BEGIN
  SELECT user_id INTO v_a FROM _actors LIMIT 1;
  SELECT user_id INTO v_b FROM _actors OFFSET 1 LIMIT 1;
  IF v_a IS NULL THEN RAISE EXCEPTION 'Need at least 1 member_profiles row to seed'; END IF;
  IF v_b IS NULL THEN v_b := v_a; END IF;

  -- Trips
  INSERT INTO public.trips (created_by, assigned_to, status, pickup_date, pickup_time, pickup_address, pickup_city, pickup_zip, dropoff_address, dropoff_city, patient_first_name, patient_last_name)
  VALUES (v_a, v_b, 'pending', current_date, '09:00', '1 Test Way', 'Miami', '33101', '2 Test Ave', 'Miami', 'E2E', v_marker);

  -- Reservations (ride_requests)
  INSERT INTO public.ride_requests (requester_user_id, status, pickup_date, pickup_time, pickup_address, pickup_city, pickup_zip, dropoff_address, dropoff_city, dropoff_zip, patient_first_name, patient_last_name)
  VALUES (v_a, 'pending', current_date, '10:00', '1 Test Way', 'Miami', '33101', '2 Test Ave', 'Miami', '33102', 'E2E', v_marker);

  -- Patients
  INSERT INTO public.saved_patients (owner_id, first_name, last_name, kind)
  VALUES (v_a, 'E2E', v_marker, 'patient');

  -- Referrals (facility saved providers)
  INSERT INTO public.facility_saved_providers (facility_user_id, provider_user_id)
  VALUES (v_a, v_b)
  ON CONFLICT DO NOTHING;

  -- Messages — needs a thread first
  DECLARE v_thread uuid;
  BEGIN
    INSERT INTO public.message_threads (created_by) VALUES (v_a) RETURNING id INTO v_thread;
    INSERT INTO public.thread_participants (thread_id, user_id) VALUES (v_thread, v_a), (v_thread, v_b);
    INSERT INTO public.messages (thread_id, sender_id, body) VALUES (v_thread, v_a, 'E2E sync probe ' || v_marker);
  END;

  -- Payments (trip_payments) — link to the trip we just made
  INSERT INTO public.trip_payments (trip_id, amount_cents, status)
  SELECT id, 1000, 'pending' FROM public.trips WHERE patient_last_name = v_marker LIMIT 1;

  -- Memberships (subscriptions)
  INSERT INTO public.subscriptions (user_id, status, stripe_customer_id, stripe_subscription_id)
  VALUES (v_a, 'active', 'cus_' || v_marker, 'sub_' || v_marker)
  ON CONFLICT DO NOTHING;

  -- Documents (medicaid_packet_items) — needs a packet first
  DECLARE v_pkt uuid;
  BEGIN
    INSERT INTO public.medicaid_packets (provider_user_id, title, status)
    VALUES (v_a, 'E2E packet ' || v_marker, 'draft') RETURNING id INTO v_pkt;
    INSERT INTO public.medicaid_packet_items (packet_id, kind, label)
    VALUES (v_pkt, 'other', 'E2E doc ' || v_marker);
  END;

  -- Notifications
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (v_a, 'e2e_sync_probe', 'E2E sync probe', v_marker);

  -- Dispatchers (user_roles)
  INSERT INTO public.user_roles (user_id, role) VALUES (v_a, 'dispatcher')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seeded marker: %', v_marker;
END $$;

COMMIT;
