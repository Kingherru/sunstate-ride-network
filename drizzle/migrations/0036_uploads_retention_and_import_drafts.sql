ALTER TABLE public.csv_import_jobs
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'csv' CHECK (source_type IN ('csv','xlsx','pdf')),
  ADD COLUMN IF NOT EXISTS draft_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS actor_mfn_id text,
  ADD COLUMN IF NOT EXISTS workspace_mfn_id text;

ALTER TABLE public.trip_drafts
  ADD COLUMN IF NOT EXISTS import_job_id uuid REFERENCES public.csv_import_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_row integer,
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD COLUMN IF NOT EXISTS source text;
CREATE UNIQUE INDEX IF NOT EXISTS trip_drafts_import_row_uniq ON public.trip_drafts(import_job_id, import_row) WHERE import_job_id IS NOT NULL;

CREATE TABLE public.upload_originals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  import_job_id uuid REFERENCES public.csv_import_jobs(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('csv','xlsx','pdf')),
  source_hash text NOT NULL,
  byte_size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  deleted_at timestamptz
);
CREATE INDEX upload_originals_expiry_idx ON public.upload_originals(expires_at) WHERE deleted_at IS NULL;
GRANT SELECT ON public.upload_originals TO authenticated;
GRANT ALL ON public.upload_originals TO service_role;
ALTER TABLE public.upload_originals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Uploader reads own upload metadata" ON public.upload_originals FOR SELECT TO authenticated USING (user_id = auth.uid());
COMMENT ON TABLE public.upload_originals IS 'Temporary original upload files (7-day retention). Deleting the file never deletes drafts, requests or audit history.';