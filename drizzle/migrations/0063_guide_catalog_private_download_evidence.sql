ALTER TABLE public.courses ADD COLUMN product_kind text NOT NULL DEFAULT 'course' CHECK(product_kind IN ('course','digital_guide')), ADD COLUMN private_file_path text;
COMMENT ON COLUMN public.courses.private_file_path IS 'Server-only private object reference; excluded from public catalog projections.';
CREATE TABLE public.digital_guide_download_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,course_id uuid NOT NULL REFERENCES public.courses(id),enrollment_id uuid NOT NULL REFERENCES public.course_enrollments(id),action text NOT NULL CHECK(action='signed_access_issued'),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.digital_guide_download_events TO authenticated; GRANT ALL ON public.digital_guide_download_events TO service_role;
ALTER TABLE public.digital_guide_download_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY guide_download_owner_read ON public.digital_guide_download_events FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TRIGGER guide_download_immutable BEFORE UPDATE OR DELETE ON public.digital_guide_download_events FOR EACH ROW EXECUTE FUNCTION public.invoice_event_immutable_guard();
CREATE POLICY paid_resource_master_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='paid-resources' AND public.has_role(auth.uid(),'admin'));
COMMENT ON TABLE public.digital_guide_download_events IS 'Minimal evidence only; no PDF contents, signed URLs, card data or browser purchase claims.';