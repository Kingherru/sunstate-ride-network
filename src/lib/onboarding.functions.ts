import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { onboardingInput } from './onboarding-rules';

async function ownedSetup(context: Parameters<Parameters<typeof requireSupabaseAuth.server>[0]>[0]) {
  return context;
}

export const getOnboarding = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: person, error } = await context.supabase.from('user_profiles').select('first_name,last_name,display_name,phone,mfn_id,status,is_test_account,deleted_at,notification_preferences,onboarding_step,onboarding_completed_at').eq('user_id', context.userId).single();
    if (error || !person || person.status !== 'active' || person.is_test_account || person.deleted_at) throw new Error('Account setup unavailable');
    const { data: memberships, error: memberError } = await context.supabase.from('workspace_members').select('workspace_id,role,is_contractor,workspaces!inner(id,account_type,display_name,mfn_id,status,is_test_account,organization_type,legal_business_name,business_phone,dispatch_phone,business_address,operating_hours)').eq('user_id', context.userId).is('removed_at', null).eq('role', 'owner').eq('is_contractor', false);
    if (memberError) throw new Error('Account setup unavailable');
    const eligible = (memberships ?? []).filter(m => m.workspaces.status === 'active' && !m.workspaces.is_test_account);
    if (eligible.length !== 1) throw new Error('Setup requires one active owned account. Your existing portals remain available.');
    const workspace = eligible[0]?.workspaces;
    if (!workspace) throw new Error('Account setup unavailable');
    const [{ data: legacy, error: legacyError }, { data: patients, error: patientError }] = await Promise.all([
      context.supabase.from('member_profiles').select('npi,medicaid_number,patient_type,patient_relationship').eq('user_id', context.userId).maybeSingle(),
      workspace.account_type === 'private_pay' ? context.supabase.from('saved_patients').select('id,first_name,last_name,mobility').eq('owner_id', context.userId).eq('kind', 'patient').eq('active', true) : Promise.resolve({ data: [], error: null }),
    ]);
    if (legacyError || patientError) throw new Error('Setup details unavailable');
    return { person, workspace, legacy, patient: patients?.length === 1 ? patients[0] : null, email: typeof context.claims.email === 'string' ? context.claims.email : '' };
  });

export const saveOnboardingSection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => onboardingInput.parse(input))
  .handler(async ({ data, context }) => {
    // Derive the owner workspace again on every write; no client workspace/identity/role fields.
    const { data: person } = await context.supabase.from('user_profiles').select('status,is_test_account,deleted_at,notification_preferences,first_name,last_name').eq('user_id', context.userId).single();
    if (!person || person.status !== 'active' || person.is_test_account || person.deleted_at) throw new Error('Account setup unavailable');
    const { data: memberships, error: memberError } = await context.supabase.from('workspace_members').select('workspace_id,workspaces!inner(account_type,status,is_test_account)').eq('user_id', context.userId).eq('role', 'owner').eq('is_contractor', false).is('removed_at', null);
    if (memberError) throw new Error('Account setup unavailable');
    const owners = (memberships ?? []).filter(m => m.workspaces.status === 'active' && !m.workspaces.is_test_account);
    const owner = owners.length === 1 ? owners[0] : null;
    if (!owner) throw new Error('One active owned account required');
    if (data.section === 'personal') {
      const prefs = person.notification_preferences as { in_app?: boolean; email?: boolean } | null;
      const { error } = await context.supabase.rpc('save_personal_settings', { _first: data.firstName, _last: data.lastName, _phone: data.phone, _preferences: { in_app: prefs?.in_app ?? true, email: prefs?.email ?? false } });
      if (error) throw new Error('Could not save personal information');
    } else if (data.section === 'business') {
      if (owner.workspaces.account_type === 'private_pay') throw new Error('Business account required');
      const { section: _section, npi, medicaid_number, ...fields } = data;
      // Empty optional fields never erase established values.
      const populated = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== ''));
      const { error } = await context.supabase.from('workspaces').update(populated).eq('id', owner.workspace_id).select('id').single();
      if (error) throw new Error('Could not save business information');
      if (owner.workspaces.account_type === 'provider' && (npi || medicaid_number)) {
        const { error: legacyError } = await context.supabase.from('member_profiles').upsert({ user_id: context.userId, ...(npi && { npi }), ...(medicaid_number && { medicaid_number }) }, { onConflict: 'user_id' });
        if (legacyError) throw new Error('Business saved; provider numbers could not be saved. Please retry.');
      }
    } else {
      if (owner.workspaces.account_type !== 'private_pay') throw new Error('Personal account required');
      const { data: patients, error: readError } = await context.supabase.from('saved_patients').select('id').eq('owner_id', context.userId).eq('kind', 'patient').eq('active', true);
      if (readError || (patients?.length ?? 0) > 1) throw new Error('Manage your existing patient profiles from Settings');
      const values = { first_name: data.accountFor === 'myself' ? person.first_name || data.first_name : data.first_name, last_name: data.accountFor === 'myself' ? person.last_name || data.last_name : data.last_name, mobility: data.mobility };
      const patient = patients?.[0];
      const result = patient ? await context.supabase.from('saved_patients').update(values).eq('id', patient.id).eq('owner_id', context.userId) : await context.supabase.from('saved_patients').insert({ ...values, owner_id: context.userId, workspace_id: null, kind: 'patient' });
      if (result.error) throw new Error('Could not save patient information');
      const { error: legacyError } = await context.supabase.from('member_profiles').upsert({ user_id: context.userId, patient_type: data.accountFor === 'myself' ? 'self' : 'other' }, { onConflict: 'user_id' });
      if (legacyError) throw new Error('Patient saved; account preference could not be saved. Please retry.');
    }
    return { ok: true };
  });

export const saveOnboardingProgress = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ step: z.number().int().min(0).max(4), complete: z.boolean().default(false) }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('save_onboarding_progress', { _step: data.step, _complete: data.complete });
    if (error) throw new Error('Could not save setup progress');
    return { ok: true };
  });