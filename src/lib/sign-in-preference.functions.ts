import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccessState } from './access.functions';
import { getMyAdminPermissions } from './admin-management.functions';
import { signInPageOptions, validatedSignInPage } from './sign-in-preference-rules';

export const getSignInPreference = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccessState();
  const perms = access.isAdmin ? await getMyAdminPermissions() : undefined;
  const options = signInPageOptions(access, perms);
  const { data, error } = await context.supabase.from('user_portal_preferences').select('page_after_sign_in').eq('user_id', context.userId).maybeSingle();
  if (error) throw new Error('Sign-in preference unavailable.');
  return { options, value: validatedSignInPage(data?.page_after_sign_in, options) };
});

export const saveSignInPreference = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ page: z.string().max(100).nullable() }).strict().parse(v))
  .handler(async ({ context, data }) => {
    const access = await getAccessState();
    const perms = access.isAdmin ? await getMyAdminPermissions() : undefined;
    const options = signInPageOptions(access, perms);
    if (data.page !== null && !validatedSignInPage(data.page, options)) throw new Error('Choose an authorized page or Default.');
    if (access.profileSuspended) throw new Error('Preference unavailable.');
    const { error } = await context.supabase.from('user_portal_preferences').upsert({ user_id: context.userId, page_after_sign_in: data.page, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw new Error('Could not save sign-in preference.');
    return { ok: true };
  });