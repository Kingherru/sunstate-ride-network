import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — MyFloridaNemt.com" },
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase-js auto-detects the recovery token in the URL hash and fires
    // a PASSWORD_RECOVERY auth event; once we have a session, allow updates.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Please sign in.");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="min-h-[80vh] grid place-items-center px-6 py-20">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8">
        <h1 className="text-3xl font-extrabold tracking-tighter mb-2">Set a new password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {ready
            ? "Enter and confirm your new password below."
            : "Verifying your reset link…"}
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="password"
            required
            minLength={8}
            placeholder="New password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-background border border-input rounded-sm px-4 py-3 text-sm"
            disabled={!ready}
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-background border border-input rounded-sm px-4 py-3 text-sm"
            disabled={!ready}
          />
          <button
            type="submit"
            disabled={busy || !ready}
            className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:bg-primary/90 transition disabled:opacity-60"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </section>
  );
}
