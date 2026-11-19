CREATE FUNCTION public.user_removal_dependency_count(_user uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  n bigint := 0;
  k bigint;
  c record;
BEGIN
  -- Catalog identifiers are quoted; the target UUID is always a bound value.
  FOR c IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'uuid'
      AND table_name NOT IN ('user_profiles', 'workspace_members')
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I=$1', c.table_name, c.column_name)
      INTO k USING _user;
    n := n + k;
  END LOOP;
  RETURN n;
END;
$function$;
REVOKE ALL ON FUNCTION public.user_removal_dependency_count(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_user_removal_plan(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  p public.user_profiles;
  m boolean;
  n bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.admin_can('people', 'manage'), false) THEN
    RAISE EXCEPTION 'Manage permission required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.user_profiles WHERE user_id = _user;
  IF NOT FOUND OR public.is_master_admin(_user) THEN
    RAISE EXCEPTION 'Protected or unavailable account';
  END IF;
  m := coalesce(public.is_master_admin(auth.uid()), false);
  IF NOT m AND (
    NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user)
    OR EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user
      AND NOT coalesce(public.admin_can_account(workspace_id), false))
  ) THEN
    RAISE EXCEPTION 'Account scope required' USING ERRCODE = '42501';
  END IF;
  -- Only the already-authorized definer can reach the internal catalog scan.
  n := public.user_removal_dependency_count(_user);
  RETURN jsonb_build_object('mode', CASE WHEN m AND n = 0 THEN 'delete' ELSE 'deactivate' END,
    'master', m, 'protected_records', n, 'mfn_id', p.mfn_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_user_removal_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_removal_plan(uuid) TO authenticated, service_role;