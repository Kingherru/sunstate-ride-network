import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type PortalKind = "patient" | "provider" | "facility";

/**
 * Client-side guard for provider-only marketing pages (membership, training, etc.).
 * - Signed-out users: pass through (page is publicly indexable / can sign in).
 * - Signed-in providers/admins: pass through.
 * - Signed-in patients/facilities: redirected to their dashboard.
 */
export function useProviderOnlyGate() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      const user = data.user;
      if (!user) {
        setChecked(true);
        return;
      }
      // Admin override
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      const portal = (user.user_metadata?.portal as PortalKind | undefined) ?? "provider";
      if (!isAdmin && (portal === "patient" || portal === "facility")) {
        navigate({ to: `/${portal}/dashboard`, replace: true } as any);
        return;
      }
      setChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  return checked;
}

export function ProviderOnlyGate({ children }: { children: React.ReactNode }) {
  useProviderOnlyGate();
  return <>{children}</>;
}
