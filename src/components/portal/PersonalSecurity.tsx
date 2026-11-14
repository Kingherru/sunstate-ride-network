import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, LogOut, SendHorizonal, Eye, EyeOff, ShieldCheck, UserRound, MonitorSmartphone } from "lucide-react";
import { PortalTabbedLayout } from "./PortalTabbedLayout";
import { StatusPill, humanStatus } from "@/components/ds/status";
import { listPersonalSecurityAudit } from "@/lib/account-settings.functions";
import { usePortalQuery } from "@/components/portal/preview-data";
import { supabase } from "@/integrations/supabase/client";
import { usePortalPreview, previewBlocked } from "@/components/portal/preview-data";
import { PersonalSettings } from './PersonalSettings';
import { DsButton } from '@/components/ds/controls';
import { SecureEmailChange } from './SecureEmailChange';

/** Shared personal security panel: profile email, change password, send
 *  reset link to self, sign out, sign out of other sessions. Reused behind
 *  every portal's top-header Settings action and the admin Security tab.
 *  Never displays or stores a password; uses Supabase Auth directly. */
export function PersonalSecurity({ email, securityOnly = false }: { email?: string | null; securityOnly?: boolean }) {
  const preview = usePortalPreview();
  const [pw, setPw] = useState("");
  const [currentPw, setCurrentPw] = useState('');
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'profile' | 'password' | 'sessions' | 'security'>(securityOnly ? 'password' : 'profile');
  const [showPw, setShowPw] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const auditFn = useServerFn(listPersonalSecurityAudit);
  const audit = usePortalQuery({ queryKey: ['personal-security-audit'], queryFn: () => auditFn(), enabled: tab === 'security' });
  const [currentEmail, setCurrentEmail] = useState<string | null | undefined>(email);

  useEffect(() => {
    if (currentEmail === undefined) {
      supabase.auth.getUser().then(({ data }) => setCurrentEmail(data.user?.email ?? null));
    }
  }, [currentEmail]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview.active) { previewBlocked(); return; }
    setErr(null); setOk(null);
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
    setPw(""); setPw2(""); setOk("Password updated."); toast.success("Password updated.");
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

  const pwType = showPw ? "text" : "password";
  const card = "portal-business-section p-4 sm:p-5";
  const H = ({ icon: I, children }: { icon: typeof KeyRound; children: React.ReactNode }) => <h2 className="ds-subheading flex items-center gap-2 border-b border-ds-border pb-3 uppercase text-ds-primary"><I className="size-4 shrink-0" aria-hidden />{children}</h2>;
  return (
    <div className="portal-business-form min-w-0 w-full space-y-4">
      <PortalTabbedLayout label="Profile and security" queryKey="securityView" value={tab} onChange={setTab} options={[...(securityOnly ? [] : [{ value: 'profile' as const, label: 'Profile & contact' }]), { value: 'password', label: 'Password & sign-in' }, { value: 'sessions', label: 'Sessions & devices' }, { value: 'security', label: 'Security activity' }]} >
      {tab === 'profile' && <div className="space-y-5">
        <PersonalSettings />
        <section className={`${card} space-y-4`}>
          <H icon={UserRound}>Email &amp; confirmation</H>
          <dl className="grid gap-1"><dt className="ds-label">Current email</dt><dd className="ds-body min-w-0 break-words">{currentEmail ?? "—"}</dd></dl>
          <SecureEmailChange />
        </section>
      </div>}
      {tab === 'password' && <div className="space-y-5">
        <form onSubmit={submit} className={`${card} space-y-4`} noValidate>
          <H icon={KeyRound}>Change password</H>
          <div><label htmlFor="ps-current" className="portal-label">Current password</label><input id="ps-current" type={pwType} autoComplete="current-password" className="portal-input" value={currentPw} onChange={e => setCurrentPw(e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="ps-npw" className="portal-label">New password</label><input id="ps-npw" type={pwType} autoComplete="new-password" className="portal-input" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div><label htmlFor="ps-npw2" className="portal-label">Confirm new password</label><input id="ps-npw2" type={pwType} autoComplete="new-password" className="portal-input" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          </div>
          <DsButton variant="ghost" type="button" onClick={() => setShowPw(v => !v)} aria-pressed={showPw}>{showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}{showPw ? 'Hide passwords' : 'Show passwords'}</DsButton>
          {err && <p role="alert"><StatusPill status={err} tone="red" className="whitespace-normal" /></p>}
          {ok && <p role="status"><StatusPill status={ok} tone="green" /></p>}
          <p className="ds-caption">At least 8 characters. Your current password is verified before any change.</p>
          <div className="portal-business-actions"><DsButton type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</DsButton></div>
        </form>
        <section className={`${card} space-y-3`}>
          <H icon={SendHorizonal}>Password reset link</H>
          <p className="ds-support text-ds-text-2">Send a password reset link to your own email instead of typing a new password here.</p>
          <DsButton type="button" size="sm" variant="secondary" onClick={sendResetLink} disabled={resetBusy || !currentEmail}>{resetBusy ? "Sending…" : "Send password reset link"}</DsButton>
        </section>
      </div>}
      {tab === 'sessions' && <section className={`${card} space-y-4`}>
        <H icon={MonitorSmartphone}>Sessions &amp; devices</H>
        <p className="ds-support">You are signed in on this device. Signing out of other devices ends every other session and keeps this one active. Session identifiers are never shown.</p>
        <div className="portal-business-actions">
          <DsButton type="button" size="sm" variant="ghost" className="portal-danger-control" onClick={signOut} disabled={signOutBusy}><LogOut className="size-4" aria-hidden />Sign out</DsButton>
          <DsButton type="button" size="sm" variant="secondary" onClick={signOutEverywhere} disabled={signOutBusy}>Sign out of other devices</DsButton>
        </div>
      </section>}
      {tab === 'security' && <section className={`${card} space-y-4`}>
        <H icon={ShieldCheck}>Security activity</H>
        <p className="ds-support">Recent account security events. Passwords, tokens and secrets are never stored or shown.</p>
        {audit.isLoading && <p role="status" className="ds-support">Loading…</p>}
        {audit.isError && <p role="alert"><StatusPill status="Security activity unavailable" tone="red" /></p>}
        {!audit.isLoading && !audit.isError && !(audit.data ?? []).length && <p className="ds-support">No security events recorded.</p>}
        <ul className="divide-y divide-ds-border">{((audit.data ?? []) as { id: string; event_type: string; result: string | null; created_at: string }[]).map(a => <li key={a.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
          <span className="ds-body min-w-0 font-semibold">{humanStatus(a.event_type)}</span>
          {a.result ? <StatusPill status={a.result} /> : <span />}
          <span className="ds-caption">{new Date(a.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</span>
        </li>)}</ul>
      </section>}
    </PortalTabbedLayout>
    </div>
  );
}
