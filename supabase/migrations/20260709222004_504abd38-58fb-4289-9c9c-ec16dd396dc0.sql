
CREATE OR REPLACE FUNCTION public.auto_upgrade_patient_to_facility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := NEW.owner_id;
  v_portal text;
  v_count int;
BEGIN
  IF v_owner IS NULL THEN RETURN NEW; END IF;
  IF coalesce(NEW.kind, 'patient') <> 'patient' THEN RETURN NEW; END IF;

  SELECT lower(coalesce(raw_user_meta_data->>'portal',''))
    INTO v_portal
    FROM auth.users WHERE id = v_owner;

  IF v_portal <> 'patient' THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count
    FROM public.saved_patients
   WHERE owner_id = v_owner
     AND coalesce(kind, 'patient') = 'patient';

  IF v_count > 3 THEN
    UPDATE auth.users
       SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('portal','facility')
     WHERE id = v_owner;

    UPDATE public.member_profiles
       SET auto_upgraded_to_facility_at = coalesce(auto_upgraded_to_facility_at, now())
     WHERE user_id = v_owner;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_owner, 'facility_auto_upgrade',
            'Your account was upgraded to Facility',
            'Because you manage more than 3 patients, your account was automatically upgraded to a Facility Portal. Pricing does not change — it''s determined by provider availability in your area.',
            '/dashboard');
  END IF;

  RETURN NEW;
END $$;
