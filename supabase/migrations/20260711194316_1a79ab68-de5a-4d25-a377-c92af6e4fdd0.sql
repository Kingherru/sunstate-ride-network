
-- Drop the narrow legacy INSERT policy and replace it with a broader one
DROP POLICY IF EXISTS "Users upload provider docs to their own applications folder" ON storage.objects;

CREATE POLICY "Providers upload their own provider docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'provider-docs'
  AND (
    -- applications/{uid}/...
    ((storage.foldername(name))[1] = 'applications' AND (storage.foldername(name))[2] = auth.uid()::text)
    -- credentials/{uid}/...
    OR ((storage.foldername(name))[1] = 'credentials' AND (storage.foldername(name))[2] = auth.uid()::text)
    -- medicaid-certs/{uid}/...
    OR ((storage.foldername(name))[1] = 'medicaid-certs' AND (storage.foldername(name))[2] = auth.uid()::text)
    -- packets/{uid}/{packet_id}/... — provider must own the packet
    OR (
      (storage.foldername(name))[1] = 'packets'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM public.medicaid_packets p
        WHERE p.id::text = (storage.foldername(name))[3]
          AND p.provider_user_id = auth.uid()
      )
    )
  )
);

-- Allow providers to read (download / signed URL) the files they uploaded
CREATE POLICY "Providers read their own provider docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'provider-docs'
  AND (
    ((storage.foldername(name))[1] IN ('applications','credentials','medicaid-certs'))
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  OR (
    bucket_id = 'provider-docs'
    AND (storage.foldername(name))[1] = 'packets'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
);
