CREATE OR REPLACE FUNCTION public.admin_set_membership(_user_id uuid, _tier membership_tier, _status text DEFAULT 'active')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_ops_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_status := lower(coalesce(_status, 'active'));
  IF v_status NOT IN ('active', 'inactive', 'canceled', 'past_due') THEN
    RAISE EXCEPTION 'Invalid membership status: %', _status;
  END IF;

  IF _tier = 'none' THEN
    v_status := 'inactive';
  END IF;

  UPDATE public.member_profiles
     SET membership_tier = _tier,
         membership_status = v_status,
         updated_at = now()
   WHERE user_id = _user_id;

  IF NOT FOUND THEN
    -- Accounts that never completed onboarding have no profile row yet.
    INSERT INTO public.member_profiles (user_id, membership_tier, membership_status)
    VALUES (_user_id, _tier, v_status)
    ON CONFLICT (user_id) DO UPDATE
      SET membership_tier = EXCLUDED.membership_tier,
          membership_status = EXCLUDED.membership_status,
          updated_at = now();
  END IF;

  PERFORM public.log_staff_action(
    'membership_change',
    'member_profiles',
    _user_id::text,
    jsonb_build_object('tier', _tier, 'status', v_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_membership(uuid, membership_tier, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_membership(uuid, membership_tier, text) TO authenticated, service_role;