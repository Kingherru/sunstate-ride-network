CREATE FUNCTION public.classify_new_onboarding_workspace() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE label text;
BEGIN
 SELECT raw_user_meta_data->>'organization_type' INTO label FROM auth.users WHERE id=NEW.created_by;
 IF NEW.account_type='provider' THEN NEW.organization_type:='transportation_provider';
 ELSIF NEW.account_type='private_pay' THEN NEW.organization_type:='private_pay_patient';
 ELSIF NEW.account_type='hospital' THEN NEW.organization_type:='hospital';
 ELSIF NEW.account_type='facility' AND label IN ('general_facility','medical_facility','hospital','broker','insurance_company','group_home','nursing_home','other_organization') THEN NEW.organization_type:=label;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.classify_new_onboarding_workspace() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER classify_new_onboarding_workspace BEFORE INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.classify_new_onboarding_workspace();
COMMENT ON FUNCTION public.classify_new_onboarding_workspace() IS 'Allowlisted business display classification on new accounts only; never changes permissions or existing rows.';