
-- 1. Compliance columns on provider_applications
ALTER TABLE public.provider_applications
  ADD COLUMN IF NOT EXISTS compliance_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS compliance_notes text,
  ADD COLUMN IF NOT EXISTS compliance_review_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS compliance_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS compliance_updated_by uuid,
  ADD COLUMN IF NOT EXISTS compliance_last_escalated_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_applications_compliance_status_check'
  ) THEN
    ALTER TABLE public.provider_applications
      ADD CONSTRAINT provider_applications_compliance_status_check
      CHECK (compliance_status IN ('approved','caution','review','denied'));
  END IF;
END $$;

-- 2. Rewrite auto-review trigger: auto-approve with caution for non-critical gaps.
CREATE OR REPLACE FUNCTION public.auto_review_provider_application()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_required_docs text[] := ARRAY['drivers_license','insurance','w9','vehicle_registration','hipaa'];
  v_doc_kinds text[];
  v_missing text[];
  v_expired text[];
  v_today date := current_date;
  v_basic_ok boolean;
  v_docs_ok boolean;
  v_profile_ok boolean;
  v_zone uuid;
  v_notified int := 0;
  v_issue_summary text;
  r record;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  IF coalesce(NEW.status, 'pending') NOT IN ('pending','new') THEN RETURN NEW; END IF;

  SELECT coalesce(array_agg(DISTINCT (d->>'kind')), ARRAY[]::text[])
    INTO v_doc_kinds
    FROM jsonb_array_elements(coalesce(NEW.documents, '[]'::jsonb)) d;

  SELECT coalesce(array_agg(x), ARRAY[]::text[])
    INTO v_missing
    FROM unnest(v_required_docs) x
   WHERE x <> ALL(v_doc_kinds);

  SELECT coalesce(array_agg(DISTINCT (d->>'kind')), ARRAY[]::text[])
    INTO v_expired
    FROM jsonb_array_elements(coalesce(NEW.documents, '[]'::jsonb)) d
   WHERE (d->>'expires_at') IS NOT NULL
     AND (d->>'expires_at') <> ''
     AND (
       CASE WHEN (d->>'expires_at') ~ '^\d{4}-\d{2}-\d{2}' THEN (d->>'expires_at')::date ELSE NULL END
     ) < v_today;

  -- Basic company info — required to auto-approve at all.
  v_basic_ok := (
    NEW.company_name IS NOT NULL AND length(btrim(NEW.company_name)) > 0
    AND NEW.email IS NOT NULL AND length(btrim(NEW.email)) > 0
    AND NEW.phone IS NOT NULL AND length(btrim(NEW.phone)) > 0
    AND NEW.city  IS NOT NULL AND length(btrim(NEW.city))  > 0
    AND NEW.zip_code IS NOT NULL AND NEW.zip_code ~ '^\d{5}$'
    AND NEW.first_name IS NOT NULL AND length(btrim(NEW.first_name)) > 0
    AND NEW.last_name  IS NOT NULL AND length(btrim(NEW.last_name))  > 0
    AND coalesce(array_length(NEW.service_types, 1), 0) > 0
  );

  -- Extra profile fields — missing puts provider in caution, not blocked.
  v_profile_ok := (
    NEW.ein IS NOT NULL AND length(btrim(NEW.ein)) > 0
    AND NEW.driver_license_number IS NOT NULL AND length(btrim(NEW.driver_license_number)) > 0
    AND NEW.insurance_carrier IS NOT NULL AND length(btrim(NEW.insurance_carrier)) > 0
    AND NEW.insurance_policy_number IS NOT NULL AND length(btrim(NEW.insurance_policy_number)) > 0
  );

  v_docs_ok := (
    coalesce(array_length(v_missing, 1), 0) = 0
    AND coalesce(array_length(v_expired, 1), 0) = 0
  );

  -- Build human-readable issue summary
  v_issue_summary := '';
  IF NOT v_profile_ok THEN
    v_issue_summary := 'incomplete profile fields';
  END IF;
  IF coalesce(array_length(v_missing, 1), 0) > 0 THEN
    IF length(v_issue_summary) > 0 THEN v_issue_summary := v_issue_summary || '; '; END IF;
    v_issue_summary := v_issue_summary || 'missing docs: ' || array_to_string(v_missing, ', ');
  END IF;
  IF coalesce(array_length(v_expired, 1), 0) > 0 THEN
    IF length(v_issue_summary) > 0 THEN v_issue_summary := v_issue_summary || '; '; END IF;
    v_issue_summary := v_issue_summary || 'expired docs: ' || array_to_string(v_expired, ', ');
  END IF;

  IF v_basic_ok THEN
    -- Auto-approve. Compliance status green if everything looks good, else caution.
    NEW.status := 'approved';
    NEW.reviewed_at := now();
    IF v_docs_ok AND v_profile_ok THEN
      NEW.compliance_status := 'approved';
      NEW.compliance_notes := NULL;
      NEW.review_notes := 'Auto-approved: profile and documents complete.';
    ELSE
      NEW.compliance_status := 'caution';
      NEW.compliance_notes := 'Auto-flagged for compliance review — ' || v_issue_summary || '. Provider remains active; work with them to resolve.';
      NEW.review_notes := 'Auto-approved with caution: ' || v_issue_summary || '.';
    END IF;
    NEW.compliance_updated_at := now();

    -- Notify staff when caution
    IF NEW.compliance_status = 'caution' THEN
      IF NEW.zip_code IS NOT NULL THEN
        SELECT zone_id INTO v_zone FROM public.dispatch_zone_zips
         WHERE zip = substring(regexp_replace(NEW.zip_code, '\D', '', 'g') FROM 1 FOR 5) LIMIT 1;
      END IF;
      IF v_zone IS NOT NULL THEN
        FOR r IN SELECT DISTINCT zma.user_id FROM public.zone_manager_assignments zma WHERE zma.zone_id = v_zone LOOP
          INSERT INTO public.notifications (user_id, type, title, body, link)
          VALUES (r.user_id, 'provider_compliance_caution',
                  'Provider in Caution status',
                  coalesce(NEW.company_name,'A provider') ||
                    ' was auto-approved but placed in Caution (' || v_issue_summary || '). Follow up to resolve.',
                  '/admin?tab=providers');
          v_notified := v_notified + 1;
        END LOOP;
      END IF;
      IF v_notified = 0 THEN
        FOR r IN SELECT DISTINCT user_id FROM public.user_roles
                 WHERE role IN ('admin','app_manager','dispatcher','zone_manager','staff') LOOP
          INSERT INTO public.notifications (user_id, type, title, body, link)
          VALUES (r.user_id, 'provider_compliance_caution',
                  'Provider in Caution status',
                  coalesce(NEW.company_name,'A provider') ||
                    ' was auto-approved but placed in Caution (' || v_issue_summary || ').',
                  '/admin?tab=providers');
        END LOOP;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Basic info missing — request manual review (do NOT deny).
  IF length(v_issue_summary) = 0 THEN
    v_issue_summary := 'missing basic company information';
  END IF;

  IF NEW.zip_code IS NOT NULL THEN
    SELECT zone_id INTO v_zone FROM public.dispatch_zone_zips
     WHERE zip = substring(regexp_replace(NEW.zip_code, '\D', '', 'g') FROM 1 FOR 5) LIMIT 1;
  END IF;
  IF v_zone IS NOT NULL THEN
    FOR r IN SELECT DISTINCT zma.user_id FROM public.zone_manager_assignments zma WHERE zma.zone_id = v_zone LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.user_id, 'provider_application_review',
              'Provider application needs manual review',
              coalesce(NEW.company_name,'A provider') || ' submitted an application that requires manual review (' || v_issue_summary || ').',
              '/admin?tab=providers');
      v_notified := v_notified + 1;
    END LOOP;
  END IF;
  IF v_notified = 0 THEN
    FOR r IN SELECT DISTINCT user_id FROM public.user_roles
             WHERE role IN ('admin','app_manager','dispatcher','zone_manager','staff') LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.user_id, 'provider_application_review',
              'Provider application needs manual review',
              coalesce(NEW.company_name,'A provider') || ' submitted an application that requires manual review (' || v_issue_summary || ').',
              '/admin?tab=providers');
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

-- 3. Sync applicant's member_profile on auto-approve (INSERT).
CREATE OR REPLACE FUNCTION public.sync_member_profile_on_provider_auto_approve()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_zone uuid;
BEGIN
  IF NEW.status <> 'approved' OR v_uid IS NULL THEN RETURN NEW; END IF;

  IF NEW.zip_code IS NOT NULL THEN
    SELECT zone_id INTO v_zone FROM public.dispatch_zone_zips
     WHERE zip = substring(regexp_replace(NEW.zip_code, '\D', '', 'g') FROM 1 FOR 5) LIMIT 1;
  END IF;

  INSERT INTO public.member_profiles (user_id, provider_application_id, company_name, first_name, last_name, phone,
                                      dispatch_email, city, region, postal_code, npi, dispatch_zone_id, preferred_zip_codes)
    VALUES (v_uid, NEW.id, NEW.company_name, NEW.first_name, NEW.last_name, NEW.phone,
            coalesce(NEW.dispatch_email, NEW.email), NEW.city,
            coalesce(NEW.region, 'Statewide Florida'), NEW.zip_code, NEW.npi, v_zone,
            coalesce(NEW.preferred_zip_codes, ARRAY[]::text[]))
    ON CONFLICT (user_id) DO UPDATE SET
      provider_application_id = EXCLUDED.provider_application_id,
      company_name = coalesce(EXCLUDED.company_name, public.member_profiles.company_name),
      first_name = coalesce(EXCLUDED.first_name, public.member_profiles.first_name),
      last_name  = coalesce(EXCLUDED.last_name,  public.member_profiles.last_name),
      phone = coalesce(EXCLUDED.phone, public.member_profiles.phone),
      dispatch_email = coalesce(EXCLUDED.dispatch_email, public.member_profiles.dispatch_email),
      city = coalesce(EXCLUDED.city, public.member_profiles.city),
      region = coalesce(EXCLUDED.region, public.member_profiles.region),
      postal_code = coalesce(EXCLUDED.postal_code, public.member_profiles.postal_code),
      npi = coalesce(EXCLUDED.npi, public.member_profiles.npi),
      dispatch_zone_id = coalesce(EXCLUDED.dispatch_zone_id, public.member_profiles.dispatch_zone_id),
      preferred_zip_codes = coalesce(EXCLUDED.preferred_zip_codes, public.member_profiles.preferred_zip_codes);
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS sync_member_profile_on_provider_auto_approve_trg ON public.provider_applications;
CREATE TRIGGER sync_member_profile_on_provider_auto_approve_trg
  AFTER INSERT ON public.provider_applications
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_profile_on_provider_auto_approve();

-- 4. is_approved_provider: treat approved unless compliance is 'denied'.
CREATE OR REPLACE FUNCTION public.is_approved_provider(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.member_profiles mp
      JOIN public.provider_applications pa ON pa.id = mp.provider_application_id
     WHERE mp.user_id = _user_id
       AND pa.status = 'approved'
       AND coalesce(pa.compliance_status, 'approved') <> 'denied'
  );
$function$;

-- 5. Medicaid trip guard: also block if compliance_status is caution/review/denied.
CREATE OR REPLACE FUNCTION public.enforce_medicaid_verification_on_assign()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_verified boolean;
  v_compliance text;
  is_medicaid boolean;
BEGIN
  IF NEW.assigned_to IS NULL OR NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  is_medicaid := (
    coalesce(lower(NEW.payer), '') LIKE '%medicaid%'
    OR NEW.medicaid_number IS NOT NULL
    OR NEW.medicaid_plan IS NOT NULL
  );

  IF NOT is_medicaid THEN RETURN NEW; END IF;

  SELECT medicaid_verified INTO v_verified FROM public.member_profiles WHERE user_id = NEW.assigned_to;
  IF NOT coalesce(v_verified, false) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.assigned_to, 'medicaid_verification_required',
              'Medicaid trip blocked — verification required',
              'A Medicaid-funded trip could not be assigned because your Medicaid credentials are missing or unverified.',
              '/provider/dashboard?tab=medicaid');
    RAISE EXCEPTION 'Provider Medicaid credentials are not verified; Medicaid trip assignment blocked.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT pa.compliance_status INTO v_compliance
    FROM public.member_profiles mp
    JOIN public.provider_applications pa ON pa.id = mp.provider_application_id
   WHERE mp.user_id = NEW.assigned_to;
  IF v_compliance IN ('caution','review','denied') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.assigned_to, 'medicaid_compliance_hold',
              'Medicaid trip blocked — compliance review',
              'Your account is under compliance review (' || v_compliance || '). Medicaid trips are paused until compliance returns to Approved.',
              '/provider/dashboard');
    RAISE EXCEPTION 'Provider compliance status % blocks Medicaid trip assignment.', v_compliance
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $function$;

-- 6. Backfill existing approved applications to compliance_status = approved.
UPDATE public.provider_applications SET compliance_status = 'approved'
 WHERE compliance_status IS NULL OR compliance_status = '';

-- 7. pg_cron: escalate reviews past 48h (every hour).
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.escalate_overdue_compliance_reviews()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE app record; r record;
BEGIN
  FOR app IN
    SELECT id, company_name, zip_code, compliance_review_started_at
      FROM public.provider_applications
     WHERE compliance_status = 'review'
       AND compliance_review_started_at IS NOT NULL
       AND compliance_review_started_at < now() - interval '48 hours'
       AND (compliance_last_escalated_at IS NULL OR compliance_last_escalated_at < now() - interval '1 hour')
  LOOP
    FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','app_manager','zone_manager') LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.user_id, 'provider_compliance_overdue',
              'OVERDUE: provider compliance review',
              coalesce(app.company_name,'A provider') ||
                ' has been in compliance Review since ' ||
                to_char(app.compliance_review_started_at, 'YYYY-MM-DD HH24:MI') ||
                '. Please decide: return to Approved, keep in Caution, or Deny.',
              '/admin?tab=providers');
    END LOOP;
    UPDATE public.provider_applications SET compliance_last_escalated_at = now() WHERE id = app.id;
  END LOOP;
END $function$;

DO $$ BEGIN
  PERFORM cron.unschedule('escalate-overdue-compliance-reviews');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'escalate-overdue-compliance-reviews',
  '0 * * * *',
  $$SELECT public.escalate_overdue_compliance_reviews();$$
);
