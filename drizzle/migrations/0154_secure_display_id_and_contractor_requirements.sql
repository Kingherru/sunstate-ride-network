CREATE OR REPLACE FUNCTION public.ensure_member_display_id()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_current text;
  v_portal text;
  v_prefix text;
  v_num bigint;
  v_new text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT display_id INTO v_current FROM public.member_profiles WHERE user_id = v_uid;
  IF v_current IS NOT NULL AND v_current <> '' THEN RETURN v_current; END IF;
  IF public.has_role(v_uid, 'staff') OR public.has_role(v_uid, 'admin') THEN
    v_portal := 'staff';
  ELSE
    SELECT lower(coalesce(raw_user_meta_data->>'portal', 'provider')) INTO v_portal FROM auth.users WHERE id = v_uid;
  END IF;
  IF v_portal = 'patient' THEN v_prefix := 'PAT'; v_num := nextval('public.patient_display_seq');
  ELSIF v_portal = 'facility' THEN v_prefix := 'FAC'; v_num := nextval('public.facility_display_seq');
  ELSIF v_portal = 'staff' THEN v_prefix := 'STF'; v_num := nextval('public.staff_display_seq');
  ELSE v_prefix := 'FLNP'; v_num := nextval('public.provider_display_seq');
  END IF;
  v_new := v_prefix || '-' || lpad(v_num::text, 6, '0');
  INSERT INTO public.member_profiles (user_id, display_id) VALUES (v_uid, v_new)
    ON CONFLICT (user_id) DO UPDATE SET display_id = EXCLUDED.display_id
    WHERE public.member_profiles.display_id IS NULL;
  SELECT display_id INTO v_current FROM public.member_profiles WHERE user_id = v_uid;
  RETURN v_current;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.ensure_member_display_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_member_display_id() TO authenticated;

DROP POLICY IF EXISTS requirements_read ON public.contractor_requirements;
CREATE POLICY requirements_read ON public.contractor_requirements FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR (active AND EXISTS (SELECT 1 FROM public.workspace_members m JOIN public.workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = auth.uid() AND m.removed_at IS NULL AND w.account_type = 'provider'))
);