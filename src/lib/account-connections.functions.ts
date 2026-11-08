import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { connectionScope, invitationActionInput, normalizeBusinessMatch, invitationStatus } from './account-connections-rules';
const invitationColumns = 'id,mfn_id,inviter_workspace_id,recipient_workspace_id,intended_type,intended_account_type,status,expires_at,created_at,updated_at,generation,delivery_status' as const;

export const getAccountConnections = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => connectionScope.parse(i))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc('can_manage_account_connections', { _ws: data.workspaceId });
    if (!allowed) throw new Error('Connections require an active account owner or administrator.');
    const [{ data: preferences, error: pError }, { data: connections, error: cError }, { data: sent, error: sError }] = await Promise.all([
      context.supabase.from('account_relationship_preferences').select('*').eq('workspace_id', data.workspaceId).maybeSingle(),
      context.supabase.from('account_business_connections').select('*').or(`workspace_a.eq.${data.workspaceId},workspace_b.eq.${data.workspaceId}`).order('created_at', { ascending: false }),
      context.supabase.from('account_connection_invitations').select(invitationColumns).eq('inviter_workspace_id', data.workspaceId).order('created_at', { ascending: false }).limit(100),
    ]);
    if (pError || cError || sError) throw new Error('Connections are unavailable.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // Exact authenticated email only. This never reveals a directory of personal accounts.
    const email = typeof context.claims.email === 'string' ? context.claims.email.trim().toLowerCase() : '';
    const { data: incoming } = await supabaseAdmin.from('account_connection_invitations').select(invitationColumns).eq('recipient_email', email).neq('inviter_workspace_id', data.workspaceId).order('created_at', { ascending: false }).limit(100);
    const { data: ws } = await context.supabase.from('workspaces').select('account_type').eq('id', data.workspaceId).single();
    const filtered = (incoming ?? []).filter(i => (!i.recipient_workspace_id || i.recipient_workspace_id===data.workspaceId) && (i.intended_account_type==='patient'?ws?.account_type==='private_pay':i.intended_type === 'provider' ? ws?.account_type === 'provider' : ['facility','hospital'].includes(ws?.account_type ?? '')));
    const ids = new Set<string>();
    for (const c of connections ?? []) { ids.add(c.workspace_a); ids.add(c.workspace_b); }
    for (const i of [...(sent ?? []), ...filtered]) { ids.add(i.inviter_workspace_id); if (i.recipient_workspace_id) ids.add(i.recipient_workspace_id); }
    if (preferences?.referral_workspace_id) ids.add(preferences.referral_workspace_id); if (preferences?.preferred_provider_id) ids.add(preferences.preferred_provider_id);
    const { data: names } = ids.size ? await supabaseAdmin.from('workspaces').select('id,display_name,mfn_id,account_type').in('id', [...ids]) : { data: [] };
    const now = Date.now();
    return { preferences, connections: connections ?? [], sent: (sent ?? []).map(i => ({ ...i, status: invitationStatus(i.status,i.expires_at,now) })), incoming: filtered.map(i => ({ ...i, status: invitationStatus(i.status,i.expires_at,now) })), names: names ?? [], accountType: ws?.account_type ?? '' };
  });

export const searchConnectionBusinesses = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid(), mode: z.enum(['name','email','phone']), value: z.string().trim().min(2).max(254) }).strict().parse(i))
  .handler(async ({ data, context }) => { if(data.mode!=='name')return []; const { data: rows, error } = await context.supabase.rpc('search_connection_businesses', { _ws: data.workspaceId, _mode: data.mode, _value: normalizeBusinessMatch(data.mode,data.value) }); if (error) return []; return rows ?? []; });

export const requestAccountConnection = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((i:unknown)=>z.object({workspaceId:z.string().uuid(),targetId:z.string().uuid(),confirmed:z.literal(true)}).strict().parse(i))
  .handler(async({data,context})=>{const {error}=await context.supabase.rpc('request_existing_account_connection',{_ws:data.workspaceId,_target:data.targetId,_confirmed:true});if(error)throw new Error('Connection unavailable.');return {ok:true};});

export const saveRelationshipPreference = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid(), kind: z.enum(['referral','preferred']), targetId: z.string().uuid().nullable(), name: z.string().trim().max(200).default(''), confirmed: z.literal(true), source: z.enum(['settings','onboarding']) }).strict().parse(i))
  .handler(async ({ data, context }) => { const { error } = await context.supabase.rpc('save_account_relationship_preferences', { _ws: data.workspaceId, _kind: data.kind, _target: data.targetId, _name: data.name, _confirmed: data.confirmed, _source: data.source } as never); if (error) throw new Error('Confirm a currently listed business, or save a referral name without linking an account.'); return { ok: true }; });

export const manageConnectionInvitation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => invitationActionInput.parse(i))
  .handler(async ({ data, context }) => {
    const { generateInvitationToken, hashInvitationToken } = await import('./account-connections-token.server');
    const send = data.action === 'send' || data.action === 'resend';
    const token = send ? generateInvitationToken() : data.token;
    const hash = token ? await hashInvitationToken(token) : null;
    // PostgreSQL nullable arguments are emitted as non-nullable by generated types; null is intentional for inapp acceptance and clear-preference actions.
    const args = { _ws: data.workspaceId, _action: data.action, _id: data.invitationId ?? null, _email: data.email ?? null, _type: data.intendedType ?? null, _hash: hash, _confirmed: true };
    const { data: invitationId, error } = await context.supabase.rpc('manage_account_invitation', args as never);
    if (error || !invitationId) throw new Error('Invitation unavailable. Check the invited email, business type, account permissions and expiration; wait before resending.');
    if (!send || !token) return { ok: true, delivery: 'not_requested' };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: row } = await supabaseAdmin.from('account_connection_invitations').select('recipient_email,mfn_id,intended_type,intended_account_type,generation').eq('id', invitationId).single();
    const { data: inviter } = await context.supabase.from('workspaces').select('display_name').eq('id', data.workspaceId).single();
    if (!row) throw new Error('Invitation saved but delivery unavailable.');
    // Preserve the hash-only expiring draft. No token/link is returned or delivered while communications are OFF.
    return { ok: true, delivery: 'draft_only' };
  });

export const removeAccountConnection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid(), connectionId: z.string().uuid(), confirmed: z.literal(true) }).strict().parse(i))
  .handler(async ({ data,context }) => { const { error } = await context.supabase.rpc('deactivate_account_connection', { _ws: data.workspaceId, _id: data.connectionId, _confirmed: true }); if (error) throw new Error('Connection unavailable.'); return { ok: true }; });

export const resolveConnectionInvitation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { hashInvitationToken, constantTimeHashEqual } = await import('./account-connections-token.server'); const hash = await hashInvitationToken(data.token);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const email = typeof context.claims.email === 'string' ? context.claims.email.trim().toLowerCase() : '';
    const { data: row } = await supabaseAdmin.from('account_connection_invitations').select('id,mfn_id,intended_type,intended_account_type,status,expires_at,token_hash,inviter_workspace_id').eq('token_hash', hash).eq('recipient_email', email).maybeSingle();
    if (!row || !constantTimeHashEqual(hash,row.token_hash) || row.status !== 'pending' || Date.parse(row.expires_at) <= Date.now()) throw new Error('Invitation unavailable. Sign in with the invited email and use a current invitation.');
    const { data: inviter } = await supabaseAdmin.from('workspaces').select('display_name').eq('id',row.inviter_workspace_id).single();
    return { id: row.id, reference: row.mfn_id, intendedType: row.intended_account_type ?? row.intended_type, inviterName: inviter?.display_name ?? 'An account' };
  });

export const openConnectionConversation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId:z.string().uuid(), connectionId:z.string().uuid() }).strict().parse(i))
  .handler(async ({data,context}) => {
    const {data:canManage}=await context.supabase.rpc('can_manage_account_connections',{_ws:data.workspaceId});
    const {data:canMessage}=await context.supabase.rpc('can_access_workspace_messages',{ws:data.workspaceId});
    if(!canManage || !canMessage) throw new Error('Existing business messaging permission is required.');
    const {data:connection}=await context.supabase.from('account_business_connections').select('workspace_a,workspace_b,active').eq('id',data.connectionId).single();
    if(!connection?.active || ![connection.workspace_a,connection.workspace_b].includes(data.workspaceId)) throw new Error('Accepted connection unavailable.');
    const target=connection.workspace_a===data.workspaceId?connection.workspace_b:connection.workspace_a;
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const {data:workspaces}=await supabaseAdmin.from('workspaces').select('id,status,is_test_account').in('id',[target,data.workspaceId]);
    if(workspaces?.length!==2 || workspaces.some(w=>w.status!=='active'||w.is_test_account))throw new Error('Business unavailable.');
    const {data:conversationId,error}=await supabaseAdmin.rpc('find_or_create_workspace_conversation',{_sender_ws:data.workspaceId,_target_ws:target,_created_by:context.userId,_source:'network_profile'});
    if(error || !conversationId)throw new Error('Conversation unavailable.');
    return {conversationId};
  });