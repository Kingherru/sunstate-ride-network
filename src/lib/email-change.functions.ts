import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { emailChangeInput, hasRecentAuthentication, emailConfirmationFailure } from './email-change-rules';

export const requestSecureEmailChange = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => emailChangeInput.parse(v)).handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.from('user_profiles').select('status,deleted_at').eq('user_id', context.userId).maybeSingle();
    const { data: current, error: userError } = await context.supabase.auth.getUser();
    if (userError || !current.user?.email || profile?.status !== 'active' || profile.deleted_at) return { error: 'An active signed-in account is required.' };
    if (current.user.email.toLowerCase() === data.newEmail.toLowerCase()) return { error: 'Choose a different email address.' };
    let verifier: ReturnType<typeof createClient> | null = null;
    try {
      if (data.currentPassword) {
        const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
        const url = process.env['SUPABASE_URL'];
        if (!key || !url) return { error: 'Account security is unavailable.' };
        verifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => {
          const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h });
        } } });
        const { data: verified, error } = await verifier.auth.signInWithPassword({ email: current.user.email, password: data.currentPassword });
        if (error || verified.user?.id !== context.userId) return { error: 'Your current password could not be verified.' };
      } else if (!hasRecentAuthentication(context.claims.amr, Date.now() / 1000)) {
        return { error: 'Sign in again, then request your email change within five minutes, or enter your current password.' };
      }
      const { error } = await (verifier ?? context.supabase).auth.updateUser({ email: data.newEmail });
      if (error) {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { error: auditError } = await supabaseAdmin.rpc('audit_email_change_failure', { _user: context.userId, _expired: false });
        if (auditError) return { error: 'Email change failed; its audit could not be recorded. Please try later.' };
        return { error: 'The email change could not be requested. Your current email remains active.' };
      }
      return { ok: true as const };
    } finally {
      if (verifier) await verifier.auth.signOut({ scope: 'local' });
    }
  });

export const confirmSecureEmailChange = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ email: z.string().email().max(254), code: z.string().regex(/^\d{6,8}$/) }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: current } = await context.supabase.auth.getUser();
    if (!current.user || current.user.id !== context.userId) return { error: 'Sign in before confirming an email change.' };
    const { data: profile } = await context.supabase.from('user_profiles').select('status,deleted_at').eq('user_id', context.userId).maybeSingle();
    if (profile?.status !== 'active' || profile.deleted_at) return { error: 'An active account is required.' };
    // The standard Auth process validates the code and secure dual confirmation.
    const { data: confirmed, error } = await context.supabase.auth.verifyOtp({ email: data.email, token: data.code, type: 'email_change' });
    if (error) {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { error: auditError } = await supabaseAdmin.rpc('audit_email_change_failure', { _user: context.userId, _expired: emailConfirmationFailure(error.code) === 'expired' });
      return { error: auditError ? 'Confirmation failed and its audit could not be recorded.' : 'This confirmation code is invalid or expired. Your current email remains active.' };
    }
    // Do not serialize a session/token back to the browser or infer final confirmation.
    return { ok: true as const, confirmed: confirmed.user?.id === context.userId && confirmed.user.email?.toLowerCase() === data.email.toLowerCase() };
  });