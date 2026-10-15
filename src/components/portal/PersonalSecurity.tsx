import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { actionCls } from "@/components/portal/PortalShell";

/** Shared personal-security block reused on the portal Account page, Admin
 *  Settings and the learner settings page. Never stores or reveals a password. */
export function PersonalSecurity({ email }: { email: string | null }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!email) return setErr("No email is on file for this account.");
    if (next.length < 8) return setErr("New password must be at least 8 characters.");
    if (next !== next2) return setErr("Passwords do not match.");
    setBusy("password");
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (signInErr) { setErr("Current password is incorrect."); return; }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) { setErr(/weak|pwned|leaked/i.test(error.message) ? "Please choose a stronger password that hasn't appeared in a data breach." : "We couldn't update your password."); return; }
      setCurrent(""); setNext(""); setNext2("");
      toast.success("Password updated.");
    } finally { setBusy(null); }
  }

  async function sendReset() {
    if (!email) return;
    setBusy("reset");
    try { await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); }
    finally { setBusy(null); toast.success("If that email has an account, a reset link is on its way."); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  async function signOutOthers() {
    setBusy("others");
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) { toast.error("Couldn't sign out other sessions."); return; }
      toast.success("Other sessions have been signed out.");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="ds-subheading uppercase text-ds-primary">Profile</h2>
        <dl className="mt-3 divide-y divide-ds-border">
          <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="ds-support font-semibold uppercase tracking-[0.06em]">Email</dt>
            <dd className="ds-body break-words">{email ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="ds-subheading uppercase text-ds-primary">Change password</h2>
        <form onSubmit={changePassword} className="mt-3 max-w-md space-y-4" noValidate>
          <div><label htmlFor="cpw" className="portal-label">Current password</label><input id="cpw" type="password" autoComplete="current-password" className="portal-input" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div><label htmlFor="npw" className="portal-label">New password</label><input id="npw" type="password" autoComplete="new-password" className="portal-input" value={next} onChange={(e) => setNext(e.target.value)} /></div>
          <div><label htmlFor="npw2" className="portal-label">Confirm new password</label><input id="npw2" type="password" autoComplete="new-password" className="portal-input" value={next2} onChange={(e) => setNext2(e.target.value)} /></div>
          {err && <p role="alert" className="ds-support text-ds-error">{err}</p>}
          <button type="submit" disabled={busy === "password"} className={actionCls}>{busy === "password" ? "Updating…" : "Change password"}</button>
        </form>
      </section>

      <section>
        <h2 className="ds-subheading uppercase text-ds-primary">Password reset link</h2>
        <p className="ds-support mt-1 max-w-md">Send a password reset link to the email address on file instead of changing it here.</p>
        <button type="button" onClick={sendReset} disabled={busy === "reset" || !email} className={`${actionCls} mt-3`}>{busy === "reset" ? "Sending…" : "Send password reset link"}</button>
      </section>

      <section>
        <h2 className="ds-subheading uppercase text-ds-primary">Sessions</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={signOut} className="portal-btn-secondary">Sign out</button>
          <button type="button" onClick={signOutOthers} disabled={busy === "others"} className="portal-btn-secondary">{busy === "others" ? "Signing out…" : "Sign out other sessions"}</button>
        </div>
      </section>
    </div>
  );
}
