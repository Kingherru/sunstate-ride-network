import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, AuthMessage, authField, authLabel } from "@/components/auth/AuthShell";
import { btnAction } from "@/components/home/buttons";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — MY FLORIDA NEMT" },
      { name: "description", content: "Request a link to reset your MY FLORIDA NEMT password." },
      { property: "og:title", content: "Forgot Password — MY FLORIDA NEMT" },
      { property: "og:description", content: "Request a link to reset your MY FLORIDA NEMT password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    // Same message regardless of outcome, so account existence is never revealed.
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }).catch(() => null);
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthShell title="Forgot Password" intro="Enter your email and we'll send a reset link.">
      {sent ? (
        <div className="flex flex-col gap-5">
          <AuthMessage tone="success">If an account exists for that email, a password reset link has been sent. The link expires after a short time.</AuthMessage>
          <Link to="/login" className="text-center font-semibold text-ds-link underline underline-offset-4">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="email" className={authLabel}>Email</label>
            <input id="email" className={authField} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className={`${btnAction} w-full`} disabled={busy}>{busy ? "SENDING…" : "SEND RESET LINK"}</button>
          <Link to="/login" className="text-center font-semibold text-ds-link underline underline-offset-4">Back to sign in</Link>
        </form>
      )}
    </AuthShell>
  );
}
