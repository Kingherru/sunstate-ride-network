import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const listProviderExportRows = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict().refine(v => v.end >= v.start).parse(v))
  .handler(async ({ data, context }) => {
    const { data: memberships, error: me } = await context.supabase.from('workspace_members').select('workspace_id,role,is_contractor,workspaces!inner(account_type,status)').eq('user_id', context.userId).is('removed_at', null);
    const allowed = (memberships ?? []).filter(m => !m.is_contractor && ['owner', 'admin'].includes(m.role) && m.workspaces.account_type === 'provider' && m.workspaces.status === 'active');
    if (me || allowed.length !== 1) throw new Error('One active provider manager workspace required.');
    // Explicit owned/accepted operations plus RLS, never the provider offer list.
    const { data: rows, error } = await context.supabase.from('trips').select('id,display_id,pickup_date,pickup_time,pickup_address,pickup_city,dropoff_address,dropoff_city,status,driver_id,vehicle_id').or(`network_provider_workspace_id.eq.${allowed[0].workspace_id},assigned_to.eq.${context.userId},created_by.eq.${context.userId}`).gte('pickup_date', data.start).lte('pickup_date', data.end).order('pickup_date').order('pickup_time').limit(1000);
    if (error) throw new Error('Could not load authorized trip export.');
    return rows ?? [];
  });