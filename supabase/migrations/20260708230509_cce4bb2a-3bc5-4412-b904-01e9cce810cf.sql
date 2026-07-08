-- Fix can_message: trips uses created_by, not requester_user_id
CREATE OR REPLACE FUNCTION public.can_message(_a uuid, _b uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a_staff boolean;
  b_staff boolean;
  a_provider boolean;
  b_provider boolean;
  a_paid boolean;
  b_paid boolean;
  a_portal text;
  b_portal text;
  rel_exists boolean;
BEGIN
  IF _a IS NULL OR _b IS NULL OR _a = _b THEN RETURN false; END IF;

  a_staff := public.is_ops_staff(_a);
  b_staff := public.is_ops_staff(_b);
  IF a_staff OR b_staff THEN RETURN true; END IF;

  SELECT lower(coalesce(raw_user_meta_data->>'portal','provider')) INTO a_portal FROM auth.users WHERE id = _a;
  SELECT lower(coalesce(raw_user_meta_data->>'portal','provider')) INTO b_portal FROM auth.users WHERE id = _b;

  a_provider := coalesce(a_portal,'') IN ('provider','facility') OR public.is_approved_provider(_a);
  b_provider := coalesce(b_portal,'') IN ('provider','facility') OR public.is_approved_provider(_b);

  SELECT (membership_status='active' AND membership_tier='paid') INTO a_paid FROM public.member_profiles WHERE user_id = _a;
  SELECT (membership_status='active' AND membership_tier='paid') INTO b_paid FROM public.member_profiles WHERE user_id = _b;

  IF a_provider AND b_provider THEN
    RETURN coalesce(a_paid,false) AND coalesce(b_paid,false);
  END IF;

  IF (a_portal = 'patient' AND b_provider) OR (b_portal = 'patient' AND a_provider) THEN
    SELECT EXISTS(
      SELECT 1 FROM public.trips t
      WHERE ((t.created_by = _a AND t.assigned_to = _b)
          OR (t.created_by = _b AND t.assigned_to = _a))
    ) INTO rel_exists;
    IF rel_exists THEN RETURN true; END IF;
    SELECT EXISTS(
      SELECT 1 FROM public.ride_requests r
      WHERE ((r.requester_user_id = _a AND r.assigned_provider_id = _b)
          OR (r.requester_user_id = _b AND r.assigned_provider_id = _a))
    ) INTO rel_exists;
    RETURN coalesce(rel_exists,false);
  END IF;

  RETURN false;
END $$;
