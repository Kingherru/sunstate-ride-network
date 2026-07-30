CREATE OR REPLACE FUNCTION public.is_approved_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.member_profiles mp
      LEFT JOIN public.provider_applications pa ON pa.id = mp.provider_application_id
     WHERE mp.user_id = _user_id
       -- Providers are auto-approved at registration; an application row is
       -- optional. Only an explicit denial/rejection blocks approval.
       AND coalesce(pa.status, 'approved') NOT IN ('denied', 'rejected')
       AND coalesce(pa.compliance_status, 'approved') <> 'denied'
  );
$function$;