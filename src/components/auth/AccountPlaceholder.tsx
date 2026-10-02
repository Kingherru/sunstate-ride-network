import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./AuthShell";

/** Protected placeholder screens (portal, admin, setup, status). */
export function AccountPlaceholder({ title, children }: { title: string; children: React.ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <AuthShell title={title} wide>
      <div className="ds-body flex flex-col items-center gap-4 text-center">
        {children}
        <button onClick={signOut} className="mt-2 font-semibold text-ds-link underline underline-offset-4">Sign out</button>
      </div>
    </AuthShell>
  );
}
