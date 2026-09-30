import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Placeholder for the future user portals (provider, patient, facility).
export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Portal — My Florida NEMT" }, { name: "robots", content: "noindex" }] }),
  component: Portal,
});

function Portal() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <section className="p-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">Portal</h1>
      <p className="mt-2">Signed in as {user.email}. The new portal is being rebuilt.</p>
      <div className="mt-6 flex gap-4 text-sm">
        <Link to="/learn" className="underline">My training</Link>
        <button onClick={signOut} className="underline">Sign out</button>
      </div>
    </section>
  );
}
