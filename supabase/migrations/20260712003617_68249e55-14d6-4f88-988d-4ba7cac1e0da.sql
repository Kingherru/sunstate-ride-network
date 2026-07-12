
-- 1) Storage bucket protection via BEFORE INSERT trigger (bucket table itself is not writable).
CREATE OR REPLACE FUNCTION public.enforce_provider_docs_upload_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size bigint;
  v_mime text;
  v_max_bytes bigint := 26214400; -- 25 MB
  v_allowed text[] := ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ];
BEGIN
  IF NEW.bucket_id <> 'provider-docs' THEN
    RETURN NEW;
  END IF;

  v_size := (NEW.metadata ->> 'size')::bigint;
  v_mime := lower(coalesce(NEW.metadata ->> 'mimetype', ''));

  IF v_size IS NULL OR v_size <= 0 THEN
    RAISE EXCEPTION 'provider-docs: file size is required';
  END IF;
  IF v_size > v_max_bytes THEN
    RAISE EXCEPTION 'provider-docs: file exceeds 25 MB limit';
  END IF;
  IF v_mime = '' OR NOT (v_mime = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'provider-docs: content type % is not allowed', v_mime;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_provider_docs_upload_rules ON storage.objects;
CREATE TRIGGER trg_enforce_provider_docs_upload_rules
BEFORE INSERT OR UPDATE ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.enforce_provider_docs_upload_rules();

-- Require authenticated uploads for provider docs (drop any anon-eligible upload policy).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'storage' AND c.relname = 'objects'
       AND polname ILIKE '%provider-docs%'
       AND polname ILIKE '%upload%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.polname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users upload provider-docs applications"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'provider-docs'
  AND (storage.foldername(name))[1] = 'applications'
);

-- 2) Explicit deny-write policies on user_roles (defense-in-depth; only service_role writes).
DROP POLICY IF EXISTS "Only service role can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only service role can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only service role can delete user_roles" ON public.user_roles;

CREATE POLICY "Only service role can insert user_roles"
ON public.user_roles FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Only service role can update user_roles"
ON public.user_roles FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Only service role can delete user_roles"
ON public.user_roles FOR DELETE TO authenticated, anon USING (false);

-- 3) Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions that are
--    trigger handlers or internal helpers (never intended as PostgREST RPCs).
DO $$
DECLARE
  fn text;
  internal_defs text[] := ARRAY[
    'public.enforce_provider_credentials_on_assign()',
    'public.notify_driver_on_assignment()',
    'public.prevent_member_profile_privileged_updates()',
    'public.prevent_member_profile_privilege_escalation()',
    'public.on_medicaid_packet_item_change()',
    'public.validate_provider_rating()',
    'public.auto_review_provider_application()',
    'public.update_updated_at_column()',
    'public.bump_thread_last_message()',
    'public.sync_member_status()',
    'public.snapshot_ride_request()',
    'public.emit_trip_provider_webhook()',
    'public.notify_admins_on_feedback()',
    'public.notify_ride_request_event()',
    'public.prevent_billing_self_edit()',
    'public.enforce_medicaid_verification_on_assign()',
    'public.trg_promote_ride_request()',
    'public.on_medicaid_packet_change()',
    'public.set_trip_display_id()',
    'public.assign_trip_dispatch_zone()',
    'public.set_provider_app_display_id()',
    'public.log_provider_app_status_change()',
    'public.notify_on_trip_payment_status()',
    'public.log_ride_request_history()',
    'public.set_updated_at()',
    'public.enforce_provider_docs_upload_rules()',
    'public.enqueue_platform_webhook_event(text, jsonb)',
    'public.enqueue_provider_webhook_event(uuid, text, jsonb)',
    'public.enqueue_email(text, jsonb)',
    'public.read_email_batch(text, integer, integer)',
    'public.delete_email(text, bigint)',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.gen_webhook_secret()'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_defs LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END LOOP;
END $$;
