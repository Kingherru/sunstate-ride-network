import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const listBusinessMembers = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc('workspace_role_of', { _ws: data.workspace_id, _uid: context.userId });
    if (allowed !== 'owner' && allowed !== 'admin') throw new Error('Account owner or admin required.');
    const { data: members, error } = await context.supabase.from('workspace_members').select('user_id,role,is_contractor,record_permissions,can_manage_trips').eq('workspace_id', data.workspace_id);
    if (error) throw new Error('Could not load business permissions.');
    return members ?? [];
  });
export const setBusinessMemberPermissions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspace_id: z.string().uuid(), user_id: z.string().uuid(), permissions: z.record(z.enum(['vehicles','drivers','contacts','payers']), z.enum(['none','read','manage'])), manage_trips: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('set_business_member_permissions', { _workspace: data.workspace_id, _user: data.user_id, _permissions: data.permissions, _manage_trips: data.manage_trips });
    if (error) throw new Error(error.message);
    return { ok: true };
  });