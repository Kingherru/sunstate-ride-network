
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
  v_complete boolean;
  v_zone uuid;
  v_notified int := 0;
  v_issue_summary text;
  r record;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
  IF coalesce(NEW.status, 'pending') <> 'pending' THEN RETURN NEW; END IF;

  -- Document kinds present
  SELECT coalesce(array_agg(DISTINCT (d->>'kind')), ARRAY[]::text[])
    INTO v_doc_kinds
    FROM jsonb_array_elements(coalesce(NEW.documents, '[]'::jsonb)) d;

  -- Missing required docs
  SELECT coalesce(array_agg(x), ARRAY[]::text[])
    INTO v_missing
    FROM unnest(v_required_docs) x
   WHERE x <> ALL(v_doc_kinds);

  -- Expired required docs (any submitted doc whose expires_at is in the past)
  SELECT coalesce(array_agg(DISTINCT (d->>'kind')), ARRAY[]::text[])
    INTO v_expired
    FROM jsonb_array_elements(coalesce(NEW.documents, '[]'::jsonb)) d
   WHERE (d->>'expires_at') IS NOT NULL
     AND (d->>'expires_at') <> ''
     AND (
       CASE
         WHEN (d->>'expires_at') ~ '^\d{4}-\d{2}-\d{2}' THEN (d->>'expires_at')::date
         ELSE NULL
       END
     ) < v_today;

  v_complete := (
    NEW.company_name IS NOT NULL AND length(btrim(NEW.company_name)) > 0
    AND NEW.email IS NOT NULL AND length(btrim(NEW.email)) > 0
    AND NEW.phone IS NOT NULL AND length(btrim(NEW.phone)) > 0
    AND NEW.city  IS NOT NULL AND length(btrim(NEW.city))  > 0
    AND NEW.zip_code IS NOT NULL AND NEW.zip_code ~ '^\d{5}$'
    AND NEW.first_name IS NOT NULL AND length(btrim(NEW.first_name)) > 0
    AND NEW.last_name  IS NOT NULL AND length(btrim(NEW.last_name))  > 0
    AND coalesce(array_length(NEW.service_types, 1), 0) > 0
    AND NEW.ein IS NOT NULL AND length(btrim(NEW.ein)) > 0
    AND NEW.driver_license_number IS NOT NULL AND length(btrim(NEW.driver_license_number)) > 0
    AND NEW.insurance_carrier IS NOT NULL AND length(btrim(NEW.insurance_carrier)) > 0
    AND NEW.insurance_policy_number IS NOT NULL AND length(btrim(NEW.insurance_policy_number)) > 0
    AND coalesce(array_length(v_missing, 1), 0) = 0
    AND coalesce(array_length(v_expired, 1), 0) = 0
  );

  IF v_complete THEN
    NEW.status := 'approved';
    NEW.reviewed_at := now();
    NEW.review_notes := 'Auto-approved: all required information and documents are complete and current. Membership purchase required to unlock full platform features.';
    RETURN NEW;
  END IF;

  -- Build human-readable issue summary
  v_issue_summary := '';
  IF coalesce(array_length(v_missing, 1), 0) > 0 THEN
    v_issue_summary := v_issue_summary || 'missing: ' || array_to_string(v_missing, ', ');
  END IF;
  IF coalesce(array_length(v_expired, 1), 0) > 0 THEN
    IF length(v_issue_summary) > 0 THEN v_issue_summary := v_issue_summary || '; '; END IF;
    v_issue_summary := v_issue_summary || 'expired: ' || array_to_string(v_expired, ', ');
  END IF;
  IF length(v_issue_summary) = 0 THEN
    v_issue_summary := 'incomplete required information';
  END IF;

  -- Route to nearest dispatch zone
  IF NEW.zip_code IS NOT NULL THEN
    SELECT zone_id INTO v_zone
      FROM public.dispatch_zone_zips
     WHERE zip = substring(regexp_replace(NEW.zip_code, '\D', '', 'g') FROM 1 FOR 5)
     LIMIT 1;
  END IF;

  IF v_zone IS NOT NULL THEN
    FOR r IN
      SELECT DISTINCT zma.user_id
        FROM public.zone_manager_assignments zma
       WHERE zma.zone_id = v_zone
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.user_id, 'provider_application_review',
              'Provider application needs manual review',
              coalesce(NEW.company_name,'A provider') ||
                ' submitted an application in your zone that could not be auto-approved (' ||
                v_issue_summary || ').',
              '/admin?tab=providers');
      v_notified := v_notified + 1;
    END LOOP;
  END IF;

  IF v_notified = 0 THEN
    FOR r IN
      SELECT DISTINCT user_id
        FROM public.user_roles
       WHERE role IN ('admin','app_manager','dispatcher','zone_manager','staff')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (r.user_id, 'provider_application_review',
              'Provider application needs manual review',
              coalesce(NEW.company_name,'A provider') ||
                ' submitted an application that could not be auto-approved (' ||
                v_issue_summary || ').',
              '/admin?tab=providers');
    END LOOP;
  END IF;

  RETURN NEW;
END $function$;
