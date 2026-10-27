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
