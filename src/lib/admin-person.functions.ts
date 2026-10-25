import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const personInput = (i: unknown) => z.object({ userId: z.string().uuid() }).parse(i);
async function authorize(context: any, userId: string, level: 'read' | 'manage') {
  const { requireAdminCan, getAdminWorkspaceScope } = await import('@/lib/admin-guard.server');
  await requireAdminCan(context, 'people', level);
  const scope = await getAdminWorkspaceScope(context);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: members, error } = await supabaseAdmin.from('workspace_members').select('workspace_id,role,workspaces!inner(id,mfn_id,display_name,account_type,status,organization_type,provider_verified)').eq('user_id', userId);
  if (error) throw new Error('Account not available.');
  // Mutation requires all memberships in scope, not merely one matching workspace.
  const all = scope.all || (!!members?.length && members.every(m => scope.workspaceIds.includes(m.workspace_id)));
  const visible = (members || []).filter(m => scope.all || scope.workspaceIds.includes(m.workspace_id));
  if (level === 'manage' ? !all : !scope.all && !visible.length) throw new Error('Account not available in your scope.');
  return { supabaseAdmin, members: visible };
}
export const getAdminPerson = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).inputValidator(personInput)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, members } = await authorize(context, data.userId, 'read');
    const [profile, legacy, auth, roles, requests, trips, training, certificates] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('user_id,mfn_id,display_name,phone,status,created_at,updated_at,deleted_at').eq('user_id', data.userId).maybeSingle(),
      supabaseAdmin.from('member_profiles').select('phone,company_name,city,membership_status,membership_tier').eq('user_id', data.userId).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(data.userId),
      supabaseAdmin.from('user_roles').select('role').eq('user_id', data.userId),
      context.supabase.from('ride_requests').select('id,mfn_id,status,created_at').eq('requester_user_id', data.userId).order('created_at', { ascending: false }).limit(20),
      context.supabase.from('trips').select('id,display_id,status,pickup_date').or(`created_by.eq.${data.userId},assigned_to.eq.${data.userId}`).order('created_at', { ascending: false }).limit(20),
      context.supabase.from('course_enrollments').select('id,status,purchased_at').eq('user_id', data.userId),
      context.supabase.from('course_certificates').select('id').eq('user_id', data.userId),
    ]);
    if (!profile.data) throw new Error('Account not available.');
    return { profile: profile.data, contact: legacy.data, email: auth.data.user?.email || null, verified: !!auth.data.user?.email_confirmed_at, lastSignIn: auth.data.user?.last_sign_in_at || null, members, roles: roles.data || [], requests: requests.data || [], trips: trips.data || [], training: training.error ? null : training.data?.length || 0, certificates: certificates.error ? null : certificates.data?.length || 0 };
  });

export const prepareUserRemoval = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(personInput)
  .handler(async ({ data, context }) => {
    await authorize(context, data.userId, 'manage');
    const { data: plan, error } = await context.supabase.rpc('admin_user_removal_plan', { _user: data.userId });
    if (error || !plan) throw new Error('This account cannot be removed.');
    return plan as unknown as { mode: 'delete' | 'deactivate'; protected_records: number; master: boolean; mfn_id: string };
  });

export const removeUserAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), reason: z.string().trim().min(5).max(500), mode: z.enum(['delete','deactivate']), confirmedMfn: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await authorize(context, data.userId, 'manage');
    const { data: raw, error } = await context.supabase.rpc('admin_user_removal_plan', { _user: data.userId });
    const plan = raw as any;
    if (error || !plan || plan.mfn_id !== data.confirmedMfn || plan.mode !== data.mode) throw new Error('Account state changed. Review the consequences again.');
    // Ban first: if later cleanup fails, access remains disabled rather than deleting history.
    const ban = await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: '876000h' });
    if (ban.error) throw new Error('Login access could not be disabled. No records were removed.');
    const { error: finalizeError } = await context.supabase.rpc('admin_finalize_user_removal', { _user: data.userId, _reason: data.reason, _mode: data.mode });
    if (finalizeError) throw new Error('Login disabled; profile cleanup needs to be retried.');
    if (data.mode === 'delete') {
      // Auth's supported soft deletion destroys login credentials but preserves the UUID
      // tombstone, preventing legacy auth foreign-key cascades even if a new reference races.
      const result = await supabaseAdmin.auth.admin.deleteUser(data.userId, true);
      if (result.error) throw new Error('Account deactivated safely; permanent login removal could not finish.');
    }
    return { ok: true, mode: data.mode };
  });

export const messageAdminPerson = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), workspaceId: z.string().uuid().nullable(), body: z.string().trim().min(1).max(5000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { members } = await authorize(context, data.userId, 'read');
    const { requireAdminCan } = await import('@/lib/admin-guard.server');
    await requireAdminCan(context, 'messaging', 'manage');
    if (data.workspaceId && !members.some(m => m.workspace_id === data.workspaceId)) throw new Error('Account not available.');
    const { data: thread, error } = await context.supabase.rpc('admin_message_person', { _user: data.userId, _workspace: data.workspaceId as never, _body: data.body });
    if (error) throw new Error('Message could not be sent.');
    return { threadId: thread as string };
  });