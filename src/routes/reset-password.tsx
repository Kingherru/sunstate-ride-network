import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, AuthMessage, PasswordInput, authLabel } from "@/components/auth/AuthShell";
import { btnAction } from "@/components/home/buttons";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — MY FLORIDA NEMT" },
      { name: "description", content: "Set a new password for your MY FLORIDA NEMT account." },
      { property: "og:title", content: "Reset Password — MY FLORIDA NEMT" },
      { property: "og:description", content: "Set a new password for your MY FLORIDA NEMT account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    if (hash.get("error") || query.get("error")) { setState("invalid"); return; }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setState("ready");
    });
    const isRecovery = hash.get("type") === "recovery" || query.has("code");
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setState((s) => (s === "ready" ? s : data.session && isRecovery ? "ready" : "invalid"));
    }, 1500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setBusy(false); return setError(/weak|pwned|leaked/i.test(error.message) ? "Please choose a stronger password that hasn't appeared in a data breach." : "We couldn't update your password. Your link may have expired."); }
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <AuthShell title="Set New Password">
      {state === "checking" && <AuthMessage tone="info">Checking your reset link…</AuthMessage>}
      {state === "invalid" && (
        <div className="flex flex-col gap-5">
          <AuthMessage tone="error">This reset link is invalid or has expired. Please request a new one.</AuthMessage>
          <Link to="/forgot-password" className={`${btnAction} w-full`}>REQUEST NEW LINK</Link>
        </div>
      )}
      {state === "ready" && (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          <div>
            <label htmlFor="pw" className={authLabel}>New password</label>
            <PasswordInput id="pw" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <p className="ds-caption mt-1.5">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="pw2" className={authLabel}>Confirm new password</label>
            <PasswordInput id="pw2" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button className={`${btnAction} w-full`} disabled={busy}>{busy ? "UPDATING…" : "UPDATE PASSWORD"}</button>
        </form>
      )}
    </AuthShell>
  );
}
