-- 1) Prevent users from self-granting paid membership / bypassing billing.
DROP TRIGGER IF EXISTS trg_prevent_billing_self_edit ON public.member_profiles;
CREATE TRIGGER trg_prevent_billing_self_edit
  BEFORE INSERT OR UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_billing_self_edit();

-- 2) Scope provider-docs "applications/" uploads to the uploader's own folder.
DROP POLICY IF EXISTS "Authenticated can upload provider docs to applications folder" ON storage.objects;

CREATE POLICY "Users upload provider docs to their own applications folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'provider-docs'
    AND (storage.foldername(name))[1] = 'applications'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
