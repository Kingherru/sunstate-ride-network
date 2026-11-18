import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Presentation-only capability projection. Existing update functions and RLS remain authoritative. */
export const getRecordEditAccess = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ kind: z.enum(['contacts', 'payers', 'drivers', 'vehicles']) }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const table = data.kind === 'contacts' ? 'provider_contacts' : data.kind;
    const { data: rows, error } = await context.supabase.from(table).select('id,workspace_id');
    if (error) throw new Error('Editing permissions unavailable.');
    const checks = await Promise.all((rows ?? []).map(async row => {
      if (!row.workspace_id) return null;
      const { data: allowed, error: denied } = await context.supabase.rpc('business_record_access', { _ws: row.workspace_id, _kind: data.kind, _id: row.id, _level: 'manage' });
      return !denied && allowed === true ? row.id : null;
    }));
    return { ids: checks.filter((id): id is string => id !== null) };
  });