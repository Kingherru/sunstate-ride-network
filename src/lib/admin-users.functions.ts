import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const MANAGEABLE_ROLES = [
  "patient",
  "provider",
  "facility",
  "dispatcher",
  "zone_manager",
  "app_manager",
  "admin",
] as const;
export type ManageableRole = (typeof MANAGEABLE_ROLES)[number];

export const ROLE_LABELS: Record<ManageableRole, string> = {
  patient: "Patient",
  provider: "Provider",
  facility: "Facility",
  dispatcher: "Dispatcher",
  zone_manager: "Dispatch Zone Manager",
  app_manager: "App Manager",
  admin: "Administrator",
};

const PORTAL_ROLES: ManageableRole[] = ["patient", "provider", "facility"];
const STAFF_ROLES: ManageableRole[] = ["dispatcher", "zone_manager", "app_manager", "admin"];

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
      .map((u): AdminUser => {
        const p = profileByUser.get(u.id);
        const rawPortal = (u.user_metadata?.portal as string) ?? p?.portal ?? "unknown";
        const portal: AdminUser["portal"] =
          rawPortal === "provider" || rawPortal === "facility" || rawPortal === "patient"
            ? rawPortal
            : "unknown";
        return {
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          portal,
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
