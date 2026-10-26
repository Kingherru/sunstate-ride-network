import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export const listTrainingCompletions = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireMaster } = await import('@/lib/admin-guard.server');
    await requireMaster(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.from('course_certificates').select('id,cert_number,holder_name,issued_at,verify_token,courses(title)').order('issued_at', { ascending: false }).limit(50);
    if (error) throw new Error('Could not load completion records');
    return data ?? [];
  });