-- Read-only transaction: no users, trips, messages or offers are created.
BEGIN;
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.network_accept_offer(uuid,boolean)'::regprocedure) INTO definition;
 IF position('FOR UPDATE' in definition)=0 OR position('RAISE EXCEPTION ''Source trip no longer available''' in definition)=0 THEN
   RAISE EXCEPTION 'Acceptance must lock selection and roll back failed association';
 END IF;
 IF has_function_privilege('anon','public.network_accept_offer(uuid,boolean)','execute') THEN
   RAISE EXCEPTION 'Anonymous acceptance must be denied';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trips' AND policyname='network_exact_details_boundary' AND permissive='RESTRICTIVE') THEN
   RAISE EXCEPTION 'Exact trip data requires a restrictive assignment boundary';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='provider_trip_offers' AND indexdef LIKE '%UNIQUE%distribution_id, provider_workspace_id%') THEN
   RAISE EXCEPTION 'A provider cannot receive duplicate distribution offers';
 END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.workspaces) THEN RAISE EXCEPTION 'Access check needs existing workspaces'; END IF;
 IF EXISTS (SELECT 1 FROM public.workspaces w WHERE public.can_view_workspace_requests('ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,w.id)) THEN
   RAISE EXCEPTION 'Unrelated identity must not pass request-overlay access helpers';
 END IF;
END $$;
ROLLBACK;