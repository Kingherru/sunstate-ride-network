import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — MyFloridaNemt.com Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onForgot() {
    if (!email) return toast.error("Enter your email above, then click Forgot password");
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent. Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  async function routeAfterAuth(userId: string) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleList = (roles ?? []).map((r) => r.role);
    const isOps = ["admin", "app_manager", "zone_manager", "dispatcher", "staff"]
      .some((r) => roleList.includes(r as any));
    navigate({ to: isOps ? "/admin" : "/" });
  }

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void routeAfterAuth(data.user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Account created. You can now sign in.");
        setMode("signin");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        await router.invalidate();
        if (data.user) await routeAfterAuth(data.user.id);
        else navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }


  return (
    <section className="min-h-[80vh] grid place-items-center px-6 py-20">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8">
        <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-3">
          Admin & Staff
        </p>
        <h1 className="text-3xl font-extrabold tracking-tighter mb-6">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-background border border-input rounded-sm px-4 py-3 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-background border border-input rounded-sm px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:bg-primary/90 transition disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-xs text-muted hover:text-foreground underline underline-offset-4 text-left"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
          {mode === "signin" && (
            <button
              type="button"
              onClick={onForgot}
              disabled={busy}
              className="text-xs text-muted hover:text-foreground underline underline-offset-4 text-left"
            >
              Forgot password?
            </button>
          )}
        </div>
        <p className="mt-6 text-xs text-muted leading-relaxed">
          New accounts have no admin permissions until granted by the project owner.
        </p>
      </div>
    </section>
  );
}
