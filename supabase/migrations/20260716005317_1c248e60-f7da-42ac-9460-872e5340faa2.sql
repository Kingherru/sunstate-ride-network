
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove prior schedule if it exists (safe re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('release-eligible-payouts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'release-eligible-payouts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ehhxvjmiqobojslbwvij.lovable.app/api/public/hooks/release-eligible-payouts',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaHh2am1pcW9ib2pzbGJ3dmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjE3NjMsImV4cCI6MjA5NTIzNzc2M30.zmXFV2GwCEgJvLMJSFLCgUh5TZkBjimz4aWhTRsNBng"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
