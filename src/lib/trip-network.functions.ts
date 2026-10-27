import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { distributionInput } from '@/lib/trip-network-rules';


/** Paid Referral Network add-on (or shared trial) gates live referral activity; Master Admin is exempt. */
async function entitledWorkspaces(supabase: any, userId: string): Promise<{ admin: boolean; ids: Set<string> }> {
  const { data: admin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  const { data: rows } = await supabase.from('workspace_members').select('workspace_id,workspaces!inner(account_type,status)').eq('user_id', userId).is('removed_at', null).eq('workspaces.account_type', 'provider').eq('workspaces.status', 'active');
  const ids = new Set<string>();
  for (const r of rows ?? []) { const { data: ok } = await supabase.rpc('provider_network_entitled', { _ws: r.workspace_id }); if (ok) ids.add(r.workspace_id); }
  return { admin: !!admin, ids };
}
async function requireNetworkAddon(supabase: any, userId: string) {
  const e = await entitledWorkspaces(supabase, userId);
  if (!e.admin && e.ids.size === 0) throw new Error('The Referral Network add-on is required for Network referrals. Activate it under Settings → Membership.');
}

export type NetworkOffer = { id: string; mfn_id: string; wave_id?: string; distribution_id: string; source_mfn_id: string; service_type: string; pickup_area: string; destination_area: string; pickup_date: string; pickup_time: string; trip_type: string; estimated_miles: number | null; amount_cents: number; capability: string; expires_at: string; status: string; provider_workspace_id: string };
export type NetworkActivity = { id: string; request_id?: string; trip_id?: string; mfn_id: string; source_mfn_id: string; source_business: string | null; pickup_area: string; destination_area: string; pickup_date: string; pickup_time: string; capability: string; amount_cents: number; expires_at: string; status: string; current_radius: number | null; can_manage: boolean; offers: NetworkOffer[]; waves: { id: string; radius_miles: number; sent_at: string }[]; negotiations: { id: string; offer_id: string; side: string; action: string; amount_cents: number | null; business_note: string | null; created_at: string }[]; events: { id: string; event_type: string; created_at: string; actor_mfn_id: string | null }[] };
export const listNetworkOffers = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('network_list_offers');
  if (error) throw new Error('Could not load offers.');
  const e = await entitledWorkspaces(context.supabase, context.userId);
  return ((data ?? []) as unknown as NetworkOffer[]).filter(o => e.admin || e.ids.has(o.provider_workspace_id));
});
export const listNetworkActivity = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('network_list_activity');
  if (error) throw new Error('Could not load network activity.');
  return (data ?? []) as unknown as NetworkActivity[];
});
export const createNetworkDistribution = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => distributionInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireNetworkAddon(context.supabase, context.userId);
    const { data: id, error } = await context.supabase.rpc('network_create_distribution', { _request: data.request_id, _trip: data.trip_id, _amount: data.amount_cents, _expires: data.expires_at });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });
export const sendNetworkWave = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ distribution_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireNetworkAddon(context.supabase, context.userId);
    const { data: result, error } = await context.supabase.rpc('network_send_wave', { _distribution: data.distribution_id });
    if (error) throw new Error(error.message);
    return result as { radius: number; recipients: number };
  });
export const acceptNetworkOffer = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ offer_id: z.string().uuid(), approve_counter: z.boolean().default(false) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireNetworkAddon(context.supabase, context.userId);
    const { data: result, error } = await context.supabase.rpc('network_accept_offer', { _offer: data.offer_id, _approve: data.approve_counter });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; error?: string; trip_id?: string };
  });
export const respondNetworkOffer = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ offer_id: z.string().uuid(), action: z.enum(['counter','decline','revise','reject_counter']), amount_cents: z.number().int().positive().optional(), business_note: z.string().trim().max(300).optional(), expires_at: z.string().datetime().optional(), reason: z.enum(['no_driver','no_vehicle','schedule','distance','rate','other']).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireNetworkAddon(context.supabase, context.userId);
    const { data: result, error } = await context.supabase.rpc('network_respond_offer', { _offer: data.offer_id, _action: data.action, _amount: data.amount_cents, _note: data.business_note, _expires: data.expires_at, _reason: data.reason });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; error?: string };
  });
export const getNetworkSettings = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('trip_network_settings').select('*').eq('id', true).maybeSingle();
  if (error) throw new Error('Could not load distribution settings.');
  return data;
});
export const saveNetworkSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ wave_50_delay_minutes: z.number().int().positive().nullable(), wave_100_delay_minutes: z.number().int().positive().nullable(), wave_200_delay_minutes: z.number().int().positive().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('trip_network_settings').upsert({ id: true, ...data, automatic_expansion: false, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error('Only the Master Admin may change distribution settings.');
    return { ok: true };
  });
/** Safe source-only review; no patient fields are returned to this screen. */
export const getDistributionReadiness = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ request_id: z.string().uuid().optional(), trip_id: z.string().uuid().optional() }).refine(i => !!i.request_id !== !!i.trip_id).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = data.request_id
      ? await context.supabase.from('ride_requests').select('id,mfn_id,workspace_id,transport_type,trip_kind,pickup_city,dropoff_city,pickup_date,pickup_time,trip_type,distance_miles,pickup_lat,pickup_lng,is_test,status').eq('id', data.request_id).maybeSingle()
      : await context.supabase.from('trips').select('id,display_id,transport_type,trip_kind,pickup_city,dropoff_city,pickup_date,pickup_time,round_trip,distance_miles,pickup_lat,pickup_lng,status').eq('id', data.trip_id ?? '').maybeSingle();
    if (error || !row) throw new Error('Source not available.');
    const r = row as any;
    const { data: can } = data.request_id ? await context.supabase.rpc('admin_can', { _section: 'requests', _level: 'manage' }) : { data: true };
    let sourceWorkspace = r.workspace_id as string | undefined;
    if (data.trip_id) {
      const { data: trip } = await context.supabase.from('trips').select('ride_request_id,created_by').eq('id',data.trip_id).maybeSingle();
      if (trip?.ride_request_id) { const {data: source} = await context.supabase.from('ride_requests').select('workspace_id').eq('id',trip.ride_request_id).maybeSingle(); sourceWorkspace = source?.workspace_id ?? undefined; }
      else if (trip?.created_by) { const {data: memberships} = await context.supabase.from('workspace_members').select('workspace_id,workspaces!inner(status)').eq('user_id',trip.created_by).is('removed_at',null).eq('workspaces.status','active'); if(memberships?.length===1) sourceWorkspace=memberships[0].workspace_id; }
    }
    const { data: scope } = data.request_id ? await context.supabase.rpc('admin_can_account', { _workspace_id: r.workspace_id }) : sourceWorkspace ? await context.supabase.rpc('network_workspace_access',{_ws:sourceWorkspace,_manage:true}) : {data:false};
    if (!can || !scope) throw new Error('Distribution permission required.');
    const missing = [!r.pickup_city && 'Pickup area', !r.dropoff_city && 'Destination area', !r.pickup_date && 'Date', !r.pickup_time && 'Time', (r.pickup_lat == null || r.pickup_lng == null) && 'Reliable pickup coordinates', r.trip_kind === 'medical_delivery' && 'Medical Delivery offers are not enabled', r.is_test && 'Test sources cannot be distributed'].filter(Boolean) as string[];
    return { source_id: r.mfn_id || r.display_id, service_type: r.transport_type, pickup_area: r.pickup_city, destination_area: r.dropoff_city, pickup_date: r.pickup_date, pickup_time: r.pickup_time, trip_type: r.trip_type || (r.round_trip ? 'round_trip' : 'one_way'), estimated_miles: r.distance_miles, missing };
  });
export const markNetworkAttention = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data,error}=await context.supabase.rpc('network_mark_attention'); if(error) throw new Error(error.message); return data;
});
export const getOfferHistory = createServerFn({method:'GET'}).middleware([requireSupabaseAuth])
 .inputValidator((i:unknown)=>z.object({offer_id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
  const {data:history,error}=await context.supabase.rpc('network_offer_safe_history',{_offer:data.offer_id});
  if(error) throw new Error('Could not load history.'); return (history??[]) as unknown as {id:string;side:string;action:string;amount_cents:number|null;business_note:string|null;created_at:string}[];
 });
export const listNetworkEligibility = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data,error}=await context.supabase.rpc('network_list_eligibility'); if(error)throw new Error('Master Admin required.');
 return (data??[]) as unknown as {workspace_id:string;business_name:string;mfn_id:string;address:string|null;lat:number|null;lng:number|null;services:string[];verified_at:string|null}[];
});
export const verifyNetworkBase = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((i:unknown)=>z.object({workspace_id:z.string().uuid(),address:z.string().trim().min(1).max(300),lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),services:z.array(z.enum(['ambulatory','wheelchair','stretcher'])).min(1)}).parse(i))
 .handler(async({data,context})=>{const {error}=await context.supabase.rpc('network_set_service_base',{_workspace:data.workspace_id,_address:data.address,_lat:data.lat,_lng:data.lng,_services:data.services});if(error)throw new Error(error.message);return {ok:true};});