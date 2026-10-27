import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Mail, LogOut, SendHorizonal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalPreview, previewBlocked } from "@/components/portal/preview-data";
import { PersonalSettings } from './PersonalSettings';
import { DsButton } from '@/components/ds/controls';
import { SecureEmailChange } from './SecureEmailChange';

/** Shared personal security panel: profile email, change password, send
 *  reset link to self, sign out, sign out of other sessions. Reused behind
 *  every portal's top-header Settings action and the admin Security tab.
 *  Never displays or stores a password; uses Supabase Auth directly. */
export function PersonalSecurity({ email }: { email?: string | null }) {
  const preview = usePortalPreview();
  const [pw, setPw] = useState("");
  const [currentPw, setCurrentPw] = useState('');
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null | undefined>(email);

  useEffect(() => {
    if (currentEmail === undefined) {
      supabase.auth.getUser().then(({ data }) => setCurrentEmail(data.user?.email ?? null));
    }
  }, [currentEmail]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview.active) { previewBlocked(); return; }
    setErr(null);
    if (pw.length < 8) return setErr("Password must be at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords do not match.");
    if (!currentPw || !currentEmail) return setErr('Enter your current password to verify your identity.');
    setBusy(true);
    // Use an isolated client: reauthentication never replaces the app session.
    const { createClient } = await import('@supabase/supabase-js');
    const verifier = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: verified, error: verificationError } = await verifier.auth.signInWithPassword({ email: currentEmail, password: currentPw });
    const { data: original } = await supabase.auth.getUser();
    setCurrentPw('');
    if (verificationError || !original.user || verified.user?.id !== original.user.id) { setBusy(false); return setErr('Current password could not be verified.'); }
    await verifier.auth.signOut({ scope: 'local' });
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(/weak|pwned|leaked/i.test(error.message) ? "Please choose a stronger password that hasn't appeared in a data breach." : "We couldn't update your password.");
    setPw(""); setPw2(""); toast.success("Password updated.");
  }

  async function sendResetLink() {
    if (preview.active) { previewBlocked(); return; }
    if (!currentEmail) return;
    setResetBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, { redirectTo: `${window.location.origin}/reset-password` });
    setResetBusy(false);
    if (error) toast.error('Could not send your reset link.');
    else toast.success("If that email has an account, a reset link was sent.");
  }

  async function signOut() {
    if (preview.active) { previewBlocked(); return; }
    setSignOutBusy(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function signOutEverywhere() {
    if (preview.active) { previewBlocked(); return; }
    setSignOutBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setSignOutBusy(false);
    if (error) toast.error('Could not sign out other devices.');
    else toast.success('Other devices signed out. This session remains active.');
  }

  return (
    <div className="max-w-xl space-y-8">
      <PersonalSettings />
      <section>
        <h2 className="ds-subheading flex items-center gap-2 uppercase text-ds-primary"><Mail className="size-4" aria-hidden />Profile</h2>
        <dl className="mt-3 divide-y divide-ds-border">
          <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="ds-support font-semibold uppercase tracking-[0.06em]">Email</dt>
            <dd className="ds-body break-words">{currentEmail ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <SecureEmailChange />

      <form onSubmit={submit} className="space-y-4" noValidate>
        <h2 className="ds-subheading flex items-center gap-2 uppercase text-ds-primary"><KeyRound className="size-4" aria-hidden />Change password</h2>
        <div><label htmlFor="ps-current" className="portal-label">Current password</label><input id="ps-current" type="password" autoComplete="current-password" className="portal-input" value={currentPw} onChange={e => setCurrentPw(e.target.value)} /></div>
        <div>
          <label htmlFor="ps-npw" className="portal-label">New password</label>
          <input id="ps-npw" type="password" autoComplete="new-password" className="portal-input" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ps-npw2" className="portal-label">Confirm new password</label>
          <input id="ps-npw2" type="password" autoComplete="new-password" className="portal-input" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        {err && <p role="alert" className="ds-support text-ds-error">{err}</p>}
        <DsButton type="submit" size="sm" disabled={busy}>{busy ? "Updating…" : "Update password"}</DsButton>
      </form>

      <section className="space-y-3">
        <h2 className="ds-subheading flex items-center gap-2 uppercase text-ds-primary"><SendHorizonal className="size-4" aria-hidden />Password reset link</h2>
        <p className="ds-support text-ds-text-2">Send a password reset link to your own email instead of typing a new password here.</p>
        <DsButton type="button" size="sm" onClick={sendResetLink} disabled={resetBusy || !currentEmail}>
          {resetBusy ? "Sending…" : "Send password reset link"}
        </DsButton>
      </section>

      <section className="space-y-3">
        <h2 className="ds-subheading flex items-center gap-2 uppercase text-ds-primary"><LogOut className="size-4" aria-hidden />Sign out</h2>
        <div className="flex flex-wrap gap-3">
          <DsButton type="button" size="sm" onClick={signOut} disabled={signOutBusy}>Sign out</DsButton>
          <DsButton type="button" size="sm" variant="secondary" onClick={signOutEverywhere} disabled={signOutBusy}>Sign out of other devices</DsButton>
        </div>
      </section>
    </div>
  );
}
