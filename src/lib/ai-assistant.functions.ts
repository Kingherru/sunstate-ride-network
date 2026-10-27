import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const input = z.object({
  task: z.enum(['note_to_trip', 'summarize', 'training', 'draft_message', 'ask']),
  text: z.string().trim().min(1).max(8000),
});

export const askAdminAssistant = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { requireMaster } = await import('@/lib/admin-guard.server');
    await requireMaster(context);
    const { runAssistant } = await import('@/lib/ai-assistant.server');
    try {
      return { text: await runAssistant(data.task, data.text) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'The AI could not answer.' };
    }
  });
