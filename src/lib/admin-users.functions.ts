import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  portal: "provider" | "facility" | "patient" | "unknown";
  company_name: string | null;
  city: string | null;
  region: string | null;
  membership_status: string | null;
  membership_tier: string | null;
};

/**
 * Admin-only: list non-patient users (providers + facilities) with their email.
 * Patient PHI is EXCLUDED — admins must not see patient accounts at all.
 */
export const listNonPatientUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;

    // Verify admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull profile rows (source of portal + company info)
    const { data: profiles } = await supabaseAdmin
      .from("member_profiles")
      .select("user_id, company_name, city, region, membership_status, membership_tier");

    // Pull auth users (paged)
    const users: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      users.push(...(data?.users ?? []));
      if (!data?.users?.length || data.users.length < 200) break;
      page += 1;
      if (page > 25) break;
    }

    const profileByUser = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => profileByUser.set(p.user_id, p));

    const result: AdminUser[] = users
      .map((u) => {
        const p = profileByUser.get(u.id);
        const portal =
          ((u.user_metadata?.portal as string) ?? p?.portal ?? "unknown") as AdminUser["portal"];
        return {
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          portal: (portal === "provider" || portal === "facility" || portal === "patient")
            ? portal : "unknown",
          company_name: p?.company_name ?? null,
          city: p?.city ?? null,
          region: p?.region ?? null,
          membership_status: p?.membership_status ?? null,
          membership_tier: p?.membership_tier ?? null,
        };
      })
      // EXCLUDE patients — confidential, providers/facilities only
      .filter((u) => u.portal !== "patient")
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return result;
  });
