import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAccessState, safeReturnPath } from "@/lib/access.functions";
import { setRememberPreference } from "@/lib/session-persistence";
import { AuthShell, AuthMessage, PasswordInput, authField, authLabel } from "@/components/auth/AuthShell";
import { btnAction } from "@/components/home/buttons";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: safeReturnPath(s.redirect) ?? undefined,
    verified: s.verified === "1" ? ("1" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign In — MY FLORIDA NEMT" },
      { name: "description", content: "Sign in to your MY FLORIDA NEMT account." },
      { property: "og:title", content: "Sign In — MY FLORIDA NEMT" },
      { property: "og:description", content: "Sign in to your MY FLORIDA NEMT account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function friendly(msg: string) {
  if (/email not confirmed/i.test(msg)) return "unverified";
  if (/invalid login credentials/i.test(msg)) return "The email or password is incorrect.";
  if (/rate|too many/i.test(msg)) return "Too many attempts. Please wait a few minutes and try again.";
  return "We couldn't sign you in right now. Please try again.";
}

function Login() {
  const navigate = useNavigate();
  const { redirect, verified } = Route.useSearch();
  const access = getAccessState;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(verified ? "Your email is verified. Please sign in." : null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    setRememberPreference(remember);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setBusy(false); return setError(friendly(error.message)); }
    try {
      const state = await access();
      const target = redirect && (state.isAdmin || !redirect.startsWith("/admin")) && state.destination !== "/account-status" ? redirect : state.destination;
      navigate({ to: target as "/portal", replace: true });
    } catch {
      setBusy(false);
      setError("Signed in, but we couldn't load your account. Please refresh and try again.");
    }
  }

  async function resend() {
    await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/login?verified=1` } });
    setError(null);
    setNotice("If that account needs verification, a new email is on its way.");
  }

  return (
    <AuthShell title="Sign In" intro="Welcome back. Sign in to continue.">
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate={false}>
        {notice && <AuthMessage tone="success">{notice}</AuthMessage>}
        {error === "unverified" ? (
          <AuthMessage tone="error">
            Please verify your email before signing in.{" "}
            <button type="button" onClick={resend} className="font-semibold underline">Resend verification email</button>
          </AuthMessage>
        ) : error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <div>
          <label htmlFor="email" className={authLabel}>Email</label>
          <input id="email" className={authField} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className={authLabel}>Password</label>
            <Link to="/forgot-password" className="ds-caption text-ds-link underline underline-offset-4">Forgot password?</Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <label className="ds-body inline-flex items-center gap-2.5">
          <input type="checkbox" className="size-5 accent-[var(--ds-primary)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Keep me signed in
        </label>
        <button className={`${btnAction} w-full`} disabled={busy} aria-busy={busy}>{busy ? "SIGNING IN…" : "SIGN IN"}</button>
        <p className="ds-body text-center text-ds-text-2">
          New here? <Link to="/create-account" className="font-semibold text-ds-link underline underline-offset-4">Create an account</Link>
        </p>
      </form>
    </AuthShell>
  );
}
