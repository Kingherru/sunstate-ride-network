-- Synthetic schema test fixture only; run in an isolated database with the
-- Pass 4T functions installed, never against production records.
DO $$ DECLARE p uuid:='00000000-0000-4000-8000-000000000003';d uuid:='00000000-0000-4000-8000-000000000004';r jsonb;BEGIN
UPDATE public.drivers SET status='active' WHERE id=d;
UPDATE public.saved_patients SET preferred_driver_id=d WHERE id=p;
r:=public.patient_driver_suggestion(p,'ambulatory','2026-11-14');
IF r->>'driverId' IS DISTINCT FROM d::text THEN RAISE EXCEPTION 'Active preferred driver must be suggested';END IF;
UPDATE public.drivers SET status='inactive' WHERE id=d;
r:=public.patient_driver_suggestion(p,'ambulatory','2026-11-14');
IF r->>'driverId' IS NOT NULL OR r->>'warning' IS DISTINCT FROM 'No eligible preferred driver' THEN RAISE EXCEPTION 'Inactive preference must remain unselected';END IF;
END $$;