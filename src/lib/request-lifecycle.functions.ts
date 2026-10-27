import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { LIFECYCLE_STATES } from '@/lib/request-lifecycle';

export const getRequestLifecycle = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: req } = await context.supabase.from('ride_requests').select('lifecycle_state').eq('id', data.id).maybeSingle();
    const { data: events } = await context.supabase.from('request_status_events')
      .select('id,actor_mfn_id,action,from_state,to_state,note,created_at').eq('ride_request_id', data.id).order('created_at');
    const { data: autoOn } = await context.supabase.rpc('launch_flag_enabled', { _key: 'automatic_distribution' });
    return { state: (req?.lifecycle_state ?? 'submitted') as string, events: events ?? [], autoDistribution: autoOn === true };
  });

export const transitionRequest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    to: z.enum(LIFECYCLE_STATES),
    note: z.string().trim().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: state, error } = await context.supabase.rpc('transition_request_lifecycle', { _request: data.id, _to: data.to, _note: data.note ?? undefined });
    if (error) return { ok: false as const, error: /not allowed|not permitted|not found/i.test(error.message) ? error.message : 'Could not update the status.' };
    return { ok: true as const, state: state as string };
  });

export const markRequestViewed = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc('record_request_provider_viewed', { _request: data.id });
    return { recorded: ok === true };
  });
