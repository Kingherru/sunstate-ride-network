
DROP FUNCTION IF EXISTS public.accept_trip(uuid);
DROP FUNCTION IF EXISTS public.decline_trip(uuid, text);
DROP FUNCTION IF EXISTS public.submit_trip_quote(uuid, integer, text);

CREATE FUNCTION public.accept_trip(_trip_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_approved_provider(auth.uid()) THEN
    RAISE EXCEPTION 'Only approved providers can accept trips' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.provider_has_valid_credentials(auth.uid()) THEN
    RAISE EXCEPTION 'Provider credentials are missing or expired' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
  IF t.assigned_to IS NOT NULL AND t.assigned_to <> auth.uid() THEN
    RAISE EXCEPTION 'Trip already assigned';
  END IF;
  UPDATE public.trips SET assigned_to = auth.uid(), status = 'assigned' WHERE id = _trip_id;
  IF t.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (t.created_by, 'trip_accepted', 'A provider accepted your trip',
            'Trip ' || COALESCE(t.display_id, t.id::text) || ' has been accepted.', '/dashboard');
  END IF;
  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','app_manager','dispatcher') LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (r.user_id, 'trip_accepted', 'Provider accepted a trip',
            'Trip ' || COALESCE(t.display_id, t.id::text) || ' was accepted by a provider.', '/admin?tab=dispatch');
  END LOOP;
END $$;

CREATE FUNCTION public.decline_trip(_trip_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_approved_provider(auth.uid()) THEN
    RAISE EXCEPTION 'Only approved providers can decline trips' USING ERRCODE = 'insufficient_privilege';
  END IF;
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

CREATE FUNCTION public.submit_trip_quote(_trip_id uuid, _amount_cents integer, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; r record; t record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_approved_provider(auth.uid()) THEN
    RAISE EXCEPTION 'Only approved providers can submit trip quotes' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.provider_has_valid_credentials(auth.uid()) THEN
    RAISE EXCEPTION 'Provider credentials are missing or expired' USING ERRCODE = 'insufficient_privilege';
  END IF;
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

REVOKE ALL ON FUNCTION public.accept_trip(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_trip(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_trip_quote(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_trip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_trip(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_trip_quote(uuid, integer, text) TO authenticated;

-- 2) course_certificates: remove open anon SELECT, add scoped RPC
DROP POLICY IF EXISTS "Public can look up certs" ON public.course_certificates;

CREATE OR REPLACE FUNCTION public.verify_course_certificate(_token text)
RETURNS TABLE (
  cert_number text,
  holder_name text,
  issued_at timestamptz,
  expires_at timestamptz,
  course_title text,
  valid boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.cert_number,
         c.holder_name,
         c.issued_at,
         c.expires_at,
         co.title AS course_title,
         (c.expires_at IS NULL OR c.expires_at > now()) AS valid
    FROM public.course_certificates c
    JOIN public.courses co ON co.id = c.course_id
   WHERE c.verify_token = _token
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_course_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_course_certificate(text) TO anon, authenticated;

-- 3) provider_ratings: scope reads to relevant parties
DROP POLICY IF EXISTS "Public can read ratings" ON public.provider_ratings;
CREATE POLICY "Ratings visible to involved parties and staff"
  ON public.provider_ratings FOR SELECT
  TO authenticated
  USING (
    rater_id = auth.uid()
    OR provider_id = auth.uid()
    OR public.is_ops_staff(auth.uid())
  );

-- 4) SUPA_function_search_path_mutable
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.gen_webhook_secret() SET search_path = public;

-- 5) Revoke anon EXECUTE on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.zone_id_for_zip(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.snapshot_ride_request() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_feedback() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.emit_trip_provider_webhook() FROM anon, PUBLIC;

-- 6) provider_integrations: document ciphertext + wipe legacy plaintext
COMMENT ON COLUMN public.provider_integrations.api_key_encrypted IS
  'AES-256-GCM ciphertext of the vendor API key, produced by the app using INTEGRATIONS_ENCRYPTION_KEY. Format: v1:<iv>:<tag>:<ct> (base64). Never store plaintext.';
COMMENT ON COLUMN public.provider_integrations.webhook_secret IS
  'AES-256-GCM ciphertext of the vendor webhook secret. Same format as api_key_encrypted.';

UPDATE public.provider_integrations
   SET api_key_encrypted = NULL,
       webhook_secret = NULL
 WHERE (api_key_encrypted IS NOT NULL AND api_key_encrypted NOT LIKE 'v1:%')
    OR (webhook_secret IS NOT NULL AND webhook_secret NOT LIKE 'v1:%');
