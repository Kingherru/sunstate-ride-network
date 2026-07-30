CREATE OR REPLACE FUNCTION public.list_eligible_providers_in_region(_region text)
RETURNS TABLE(
  user_id uuid,
  display_id text,
  company_name text,
  contact_name text,
  email text,
  phone text,
  city text,
  region text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT mp.user_id,
         mp.display_id,
         mp.company_name,
         nullif(trim(concat_ws(' ', mp.first_name, mp.last_name)), ''),
         mp.dispatch_email,
         mp.phone,
         mp.city,
         mp.region
    FROM public.member_profiles mp
   WHERE auth.uid() IS NOT NULL
     AND (_region IS NULL OR mp.region = _region)
     AND mp.user_id <> auth.uid()
     AND public.is_eligible_transport_provider(mp.user_id)
   ORDER BY coalesce(mp.company_name, mp.display_id, '');
$$;

REVOKE ALL ON FUNCTION public.list_eligible_providers_in_region(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_eligible_providers_in_region(text) TO authenticated, service_role;