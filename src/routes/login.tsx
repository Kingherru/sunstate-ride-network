import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — My Florida NEMT" },
      { name: "description", content: "Sign in to your My Florida NEMT account." },
      { property: "og:title", content: "Sign In — My Florida NEMT" },
      { property: "og:description", content: "Sign in to your My Florida NEMT account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate({ to: "/portal" });
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/login" });
    if (res && "error" in res && res.error) setError(String(res.error));
  }

  return (
    <section className="p-10 max-w-sm mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className="border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="border rounded px-3 py-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button className="border rounded px-3 py-2" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <button onClick={google} className="border rounded px-3 py-2 w-full mt-3">Continue with Google</button>
      <a href="/reset-password" className="block text-sm underline mt-4">Forgot password?</a>
    </section>
  );
}
