-- 1) Scope ride_requests provider update policy to authenticated only
DROP POLICY IF EXISTS "Providers can update their assigned ride requests" ON public.ride_requests;
CREATE POLICY "Providers can update their assigned ride requests"
  ON public.ride_requests
  FOR UPDATE
  TO authenticated
  USING (is_approved_provider(auth.uid()) AND (assigned_provider_id = auth.uid()))
  WITH CHECK (is_approved_provider(auth.uid()) AND (assigned_provider_id = auth.uid()));

-- 2) Revoke anon EXECUTE on SECURITY DEFINER functions that were granted to anon
REVOKE EXECUTE ON FUNCTION public.admin_extend_unconfirmed_reservation(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_platform_fee_to_fin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_fin_fee_to_platform() FROM anon;

-- 3) Prevent client-supplied IP/user-agent metadata on contact_messages inserts.
--    The server (createServerFn / admin client) can populate these after insert
--    since service_role bypasses this trigger's effect via a direct UPDATE.
CREATE OR REPLACE FUNCTION public.contact_messages_strip_client_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Anyone inserting through the Data API (anon or authenticated) cannot set
  -- ip_address or user_agent. Only server-side code using the service role,
  -- or explicit UPDATEs after insert, can populate them.
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    NEW.ip_address := NULL;
    NEW.user_agent := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_messages_strip_client_metadata ON public.contact_messages;
CREATE TRIGGER trg_contact_messages_strip_client_metadata
  BEFORE INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.contact_messages_strip_client_metadata();