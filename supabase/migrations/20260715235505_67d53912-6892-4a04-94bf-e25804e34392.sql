CREATE OR REPLACE FUNCTION public.is_facility_or_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_approved_provider(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.member_profiles
      WHERE user_id = _user_id
        AND auto_upgraded_to_facility_at IS NOT NULL
    )
    OR public.has_any_role(_user_id, ARRAY['admin','app_manager','zone_manager','staff']::app_role[]);
$$;

REVOKE EXECUTE ON FUNCTION public.is_facility_or_provider(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_facility_or_provider(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_facility_or_provider(uuid) TO service_role;