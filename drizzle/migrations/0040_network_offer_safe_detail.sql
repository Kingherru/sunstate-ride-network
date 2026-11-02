CREATE OR REPLACE FUNCTION public.network_offer_safe_detail(_offer uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.provider_trip_offers; d public.trip_distributions; is_recv boolean; is_src boolean; live boolean; tier jsonb; latest jsonb; st text; fee integer;
BEGIN
  SELECT * INTO o FROM public.provider_trip_offers WHERE id=_offer;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Not available'; END IF;
  SELECT * INTO d FROM public.trip_distributions WHERE id=o.distribution_id;
  is_recv := public.network_workspace_access(o.provider_workspace_id,false);
  is_src := public.network_source_access(d.id,false);
  IF NOT (is_recv OR is_src) THEN RAISE EXCEPTION 'Not available'; END IF;
  st := CASE WHEN o.status IN ('pending','countered','revised') AND o.expires_at<=now() THEN 'expired' ELSE o.status END;
  live := d.selected_workspace_id IS NULL AND d.expires_at>now() AND o.expires_at>now() AND o.status IN ('pending','countered','revised');
  tier := public.network_receiver_hold_tier(o.provider_workspace_id);
  SELECT jsonb_build_object('side',n.side,'action',n.action,'amount_cents',n.amount_cents,'created_at',n.created_at) INTO latest FROM public.trip_offer_negotiations n WHERE n.offer_id=o.id ORDER BY n.created_at DESC LIMIT 1;
  fee := round(o.amount_cents * 0.02);
  RETURN jsonb_build_object(
    'offer_mfn_id', o.mfn_id, 'status', st, 'viewer', CASE WHEN is_src THEN 'sender' ELSE 'receiver' END,
    'distribution_stage_miles', d.current_radius, 'distribution_status', d.status,
    'stages', (SELECT coalesce(jsonb_agg(jsonb_build_object('radius_miles',w.radius_miles,'sent_at',w.sent_at) ORDER BY w.sent_at),'[]'::jsonb) FROM public.trip_distribution_waves w WHERE w.distribution_id=d.id),
    'versions', (SELECT coalesce(jsonb_agg(jsonb_build_object('side',n.side,'action',n.action,'amount_cents',n.amount_cents,'created_at',n.created_at) ORDER BY n.created_at),'[]'::jsonb) FROM public.trip_offer_negotiations n WHERE n.offer_id=o.id),
    'events', (SELECT coalesce(jsonb_agg(jsonb_build_object('event_type',e.event_type,'created_at',e.created_at) ORDER BY e.created_at),'[]'::jsonb) FROM public.trip_network_events e WHERE e.distribution_id=d.id AND (e.offer_id IS NULL OR e.offer_id=o.id)),
    'latest_negotiation', latest,
    'verification_tier', CASE WHEN tier IS NULL THEN NULL ELSE tier->>'tier' END,
    'receiver_payout_cents', o.amount_cents, 'network_fee_cents', fee,
    'processing_fee_rule', 'Calculated by the server from the payment method before the sender confirms payment',
    'sender_total_before_processing_cents', o.amount_cents + fee,
    'payment_ack_at', CASE WHEN is_src THEN d.payment_responsibility_ack_at END,
    'accepted', d.selected_offer_id = o.id,
    'actions', jsonb_build_object(
      'accept', live AND ((is_recv AND o.status<>'countered' AND public.network_workspace_access(o.provider_workspace_id,true)) OR (is_src AND o.status='countered' AND public.network_source_access(d.id,true))),
      'counter', live AND ((is_recv AND o.status<>'countered' AND public.network_workspace_access(o.provider_workspace_id,true)) OR (is_src AND o.status='countered' AND public.network_source_access(d.id,true))),
      'decline', live AND ((is_recv AND public.network_workspace_access(o.provider_workspace_id,true)) OR (is_src AND o.status='countered' AND public.network_source_access(d.id,true)))));
END $$;
REVOKE ALL ON FUNCTION public.network_offer_safe_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.network_offer_safe_detail(uuid) TO authenticated;