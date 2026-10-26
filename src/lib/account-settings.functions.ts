import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { personalSettingsInput } from './account-settings-rules';

export const getPersonalSettings = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('user_profiles').select('first_name,last_name,display_name,phone,mfn_id,notification_preferences,status').eq('user_id', context.userId).maybeSingle();
  if (error || !data) throw new Error('Account settings unavailable.');
  return data;
});
export const savePersonalSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => personalSettingsInput.parse(v)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('save_personal_settings', { _first: data.firstName, _last: data.lastName, _phone: data.phone, _preferences: data.preferences });
    if (error) throw new Error('Could not save personal settings.');
    return { ok: true };
  });
export const listPersonalSecurityAudit = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('account_security_audit').select('id,event_type,result,created_at,sender_mfn_id,workspace_mfn_id,driver_ids,range_start,range_end').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(30);
  if (error) throw new Error('Audit history unavailable.');
  return data ?? [];
});