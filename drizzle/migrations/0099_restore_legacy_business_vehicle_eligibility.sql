CREATE FUNCTION public.business_vehicle_service_eligible(_v public.vehicles, _service text) RETURNS boolean LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT coalesce(
   _v.status='active' AND _v.capacity>0 AND lower(_service)=ANY(_v.service_capabilities)
   AND (
     public.pass4p_vehicle_complete(_v.id)
     OR (
       _v.vehicle_category IS NULL
       AND CASE lower(_service)
         WHEN 'ambulatory' THEN _v.vehicle_type IN ('sedan','suv','van','wheelchair_van','stretcher_van','ambulance')
         WHEN 'wheelchair' THEN _v.vehicle_type='wheelchair_van'
         WHEN 'stretcher' THEN _v.vehicle_type IN ('stretcher_van','ambulance')
         ELSE false
       END
     )
   ), false
 )
$$;
REVOKE ALL ON FUNCTION public.business_vehicle_service_eligible(public.vehicles,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.business_vehicle_service_eligible(public.vehicles,text) TO service_role;
COMMENT ON FUNCTION public.business_vehicle_service_eligible(public.vehicles,text) IS 'Compatibility for uncategorized business vehicles: recorded legacy vehicle type plus explicit service capability, active status and capacity. Never grants contractor eligibility or infers services from type alone.';
CREATE OR REPLACE FUNCTION public.pass4p_service_eligible(_ws uuid,_service text,_vehicle uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.workspaces w WHERE w.id=_ws AND w.status='active' AND NOT w.is_test_account AND (
   (w.provider_subtype='independent_contractor' AND _service='ambulatory' AND coalesce((public.contractor_evidence_summary(_ws)->>'eligible')::boolean,false) AND (_vehicle IS NULL OR EXISTS(SELECT 1 FROM public.vehicles WHERE id=_vehicle AND workspace_id=_ws AND status='active' AND vehicle_category='ambulatory')))
   OR (w.provider_subtype='nemt_business' AND EXISTS(SELECT 1 FROM public.vehicles v WHERE v.workspace_id=_ws AND (_vehicle IS NULL OR v.id=_vehicle) AND public.business_vehicle_service_eligible(v,_service)))
 ))
$$;
CREATE OR REPLACE FUNCTION public.provider_active_fleet(_ws uuid,_service text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.drivers d WHERE d.workspace_id=_ws AND d.status='active' AND _service=ANY(d.service_capabilities) AND (d.license_expiry IS NULL OR d.license_expiry>=current_date))
 AND EXISTS(SELECT 1 FROM public.vehicles v JOIN public.workspaces w ON w.id=v.workspace_id WHERE v.workspace_id=_ws AND (
   (w.provider_subtype='nemt_business' AND public.business_vehicle_service_eligible(v,_service))
   OR (w.provider_subtype='independent_contractor' AND v.status='active' AND v.vehicle_category IS NOT NULL AND _service=ANY(v.service_capabilities))
 ))
$$;