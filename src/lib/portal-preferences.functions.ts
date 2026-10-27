import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type InterfaceDensity = 'compact' | 'standard' | 'comfortable';
export type PortalPreferences = { interface_density: InterfaceDensity; default_payer_id: string | null; default_payment_method_id: string | null; pay_by_invoice: boolean; invoiceEligible: boolean };

/** Pay by Invoice is limited to facility/hospital business owners and admins. */
async function invoiceEligible(supabase: any, userId: string) {
  const { data } = await supabase.from('workspace_members').select('role,is_contractor,workspaces!inner(account_type,status)').eq('user_id', userId).is('removed_at', null);
  return (data ?? []).some((m: any) => !m.is_contractor && (m.role === 'owner' || m.role === 'admin') && ['facility', 'hospital'].includes(m.workspaces.account_type) && m.workspaces.status === 'active');
}

export const getPortalPreferences = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalPreferences> => {
    const [{ data }, eligible] = await Promise.all([
      context.supabase.from('user_portal_preferences').select('interface_density,default_payer_id,default_payment_method_id,pay_by_invoice').eq('user_id', context.userId).maybeSingle(),
      invoiceEligible(context.supabase, context.userId),
    ]);
    return {
      interface_density: (data?.interface_density as InterfaceDensity) ?? 'standard',
      default_payer_id: data?.default_payer_id ?? null,
      default_payment_method_id: data?.default_payment_method_id ?? null,
      pay_by_invoice: eligible && !!data?.pay_by_invoice,
      invoiceEligible: eligible,
    };
  });

export const savePortalPreferences = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    interface_density: z.enum(['compact', 'standard', 'comfortable']).optional(),
    default_payer_id: z.string().uuid().nullable().optional(),
    default_payment_method_id: z.string().uuid().nullable().optional(),
    pay_by_invoice: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { user_id: context.userId, updated_at: new Date().toISOString() };
    if (data.interface_density) patch.interface_density = data.interface_density;
    if (data.default_payer_id !== undefined) {
      if (data.default_payer_id) {
        const { data: p } = await context.supabase.from('payers').select('id').eq('id', data.default_payer_id).eq('owner_user_id', context.userId).eq('active', true).maybeSingle();
        if (!p) throw new Error('Choose one of your active payers.');
      }
      patch.default_payer_id = data.default_payer_id;
    }
    if (data.default_payment_method_id !== undefined) {
      if (data.default_payment_method_id) {
        const { data: m } = await context.supabase.from('saved_payment_methods').select('id').eq('id', data.default_payment_method_id).eq('user_id', context.userId).maybeSingle();
        if (!m) throw new Error('Choose one of your saved cards.');
      }
      patch.default_payment_method_id = data.default_payment_method_id;
    }
    if (data.pay_by_invoice !== undefined) {
      if (data.pay_by_invoice && !(await invoiceEligible(context.supabase, context.userId))) throw new Error('Pay by Invoice is available to facility and hospital accounts.');
      patch.pay_by_invoice = data.pay_by_invoice;
    }
    const { error } = await context.supabase.from('user_portal_preferences').upsert(patch as any, { onConflict: 'user_id' });
    if (error) throw new Error('Could not save preferences.');
    return { ok: true };
  });
