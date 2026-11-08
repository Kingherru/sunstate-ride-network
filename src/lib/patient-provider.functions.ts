import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import type {NetworkProviderRow} from './facility-providers.functions';
export const getConfirmedUsualProvider=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {data,error}=await context.supabase.rpc('my_confirmed_usual_provider');if(error)throw new Error('Provider not available');return data as unknown as NetworkProviderRow|null;});
export const listTargetedPatientRequests = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('list_targeted_patient_requests');
  if (error) throw new Error('Could not load targeted requests.');
  return data ?? [];
});
export const respondTargetedPatientRequest = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid(), accept: z.boolean() }).strict().parse(v)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('respond_targeted_patient_request', { _request: data.id, _accept: data.accept });
    if (error) throw new Error('That request is no longer available or permission was denied.');
    return { ok: true };
  });