import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Frontend Contact Us submissions for admins with Messaging access. */
export const listFrontendContacts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdminCan } = await import('@/lib/admin-guard.server');
    await requireAdminCan(context, 'messaging', 'read');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.from('contact_messages')
      .select('id,created_at,category,name,business_name,email,phone,subject,message,source,read_at')
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw new Error('Contacts unavailable');
    return data ?? [];
  });

export const markFrontendContactRead = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireAdminCan } = await import('@/lib/admin-guard.server');
    await requireAdminCan(context, 'messaging', 'manage');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.from('contact_messages').update({ read_at: new Date().toISOString() }).eq('id', data.id).is('read_at', null);
    return { ok: true };
  });

/** Unread website contacts for the sidebar dot; zero for anyone without Messaging access. */
export const countUnreadFrontendContacts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await context.supabase.rpc('admin_can', { _section: 'messaging', _level: 'read' } as never);
    if (ok !== true) return { count: 0 };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { count } = await supabaseAdmin.from('contact_messages').select('id', { count: 'exact', head: true }).is('read_at', null);
    return { count: count ?? 0 };
  });
