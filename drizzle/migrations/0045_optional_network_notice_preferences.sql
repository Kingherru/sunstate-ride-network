-- Compatibility-only preference enforcement; no existing rows or jobs changed.
CREATE OR REPLACE FUNCTION public.notification_preference_allows(_user uuid, _channel text, _event text, _required boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE prefs jsonb;
BEGIN
 -- Unknown/ambiguous events remain deliverable. Only the existing initial
 -- unaccepted offer event has an unambiguous optional classification.
 IF coalesce(_required,true) OR _event IS DISTINCT FROM 'New offer received' OR _channel NOT IN ('in_app','email') OR _channel IS NULL THEN RETURN true; END IF;
 SELECT notification_preferences INTO prefs FROM public.user_profiles WHERE user_id=_user;
 RETURN coalesce(prefs->_channel <> 'false'::jsonb,true);
END $$;
REVOKE ALL ON FUNCTION public.notification_preference_allows(uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_preference_allows(uuid,text,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.network_notify(_ws uuid,_type text,_offer uuid,_important boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE required_notice boolean:=true;
BEGIN
 -- Never infer optionality from network_update or _important=false: those
 -- also carry acceptance, completion, negotiation and payment information.
 IF NOT coalesce(_important,true) AND _type='New offer received' THEN
  required_notice:=NOT EXISTS(
   SELECT 1 FROM public.provider_trip_offers o
   JOIN public.trip_distributions d ON d.id=o.distribution_id
   WHERE o.id=_offer AND o.provider_workspace_id=_ws AND o.status='pending'
    AND d.selected_workspace_id IS NULL AND d.status IN ('ready','offers_sent','negotiating','needs_attention')
  );
 END IF;
 INSERT INTO public.notifications(user_id,type,title,body,link)
 SELECT m.user_id,CASE WHEN _important THEN 'network_important' ELSE 'network_update' END,
 _type,'Controlled trip network status updated. Sign in to review.','/portal/trips'
 FROM public.workspace_members m JOIN public.user_profiles p ON p.user_id=m.user_id
 WHERE m.workspace_id=_ws AND p.status='active' AND NOT m.is_contractor
  AND (m.role IN ('owner','admin') OR m.can_manage_trips)
  AND public.notification_preference_allows(m.user_id,'in_app',_type,required_notice);
END $$;
-- Preserve the existing non-client-callable producer boundary.
REVOKE ALL ON FUNCTION public.network_notify(uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.notification_preference_allows(uuid,text,text,boolean) IS 'Internal channel preference decision. Required and unmapped notices bypass optional settings. Reads saved user preferences only; never grants notification or workspace access.';