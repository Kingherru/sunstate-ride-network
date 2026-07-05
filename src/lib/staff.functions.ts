import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StaffRole = "admin" | "app_manager" | "zone_manager" | "dispatcher" | "staff";

const STAFF_ROLES: StaffRole[] = ["admin", "app_manager", "zone_manager", "dispatcher", "staff"];

async function getCallerRoles(context: any): Promise<StaffRole[]> {
  const { data } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId);
  return (data ?? []).map((r: any) => r.role as StaffRole);
}

async function assertManager(context: any) {
  const roles = await getCallerRoles(context);
  const isAdmin = roles.includes("admin");
  const isAppManager = roles.includes("app_manager");
  if (!isAdmin && !isAppManager) {
    throw new Error("Permission denied: Administrator or App Manager role required.");
  }
  return { isAdmin, isAppManager, roles };
}

async function logAction(
  context: any,
  action: string,
  target_kind: string | null,
  target_id: string | null,
  metadata: Record<string, unknown> = {},
) {
  await context.supabase.rpc("log_staff_action", {
    _action: action,
    _target_kind: target_kind,
    _target_id: target_id,
    _metadata: metadata,
  });
}

/** List all staff (any user with a staff-level role). */
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context);
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", STAFF_ROLES);
    if (error) throw error;
    const userIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    if (userIds.length === 0) return { staff: [] as any[] };

    const { data: profiles } = await context.supabase
      .from("member_profiles")
      .select("user_id, first_name, last_name, display_id, phone")
      .in("user_id", userIds);
    const { data: assignments } = await context.supabase
      .from("zone_manager_assignments")
      .select("user_id, zone_id, dispatch_zones(name, code)")
      .in("user_id", userIds);

    const profByUser = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const staff = userIds.map((uid) => {
      const p: any = profByUser.get(uid) ?? {};
      return {
        user_id: uid,
        display_id: p.display_id ?? null,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
        phone: p.phone ?? null,
        roles: (roles ?? []).filter((r: any) => r.user_id === uid).map((r: any) => r.role),
        zones: (assignments ?? []).filter((a: any) => a.user_id === uid),
      };
    });
    return { staff };
  });

/** Grant a role to a user. App managers cannot grant admin. */
export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; role: StaffRole }) => input)
  .handler(async ({ data, context }) => {
    const { isAppManager } = await assertManager(context);
    if (isAppManager && data.role === "admin") throw new Error("Only administrators can grant admin.");
    const { error } = await context.supabase
      .from("user_roles")
      .upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw error;
    return { ok: true };
  });

/** Revoke a role from a user. App managers cannot revoke admin. */
export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; role: StaffRole }) => input)
  .handler(async ({ data, context }) => {
    const { isAppManager } = await assertManager(context);
    if (isAppManager && data.role === "admin") throw new Error("Only administrators can revoke admin.");
    const { error } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw error;
    return { ok: true };
  });

/** Look up a user id by email so managers can grant a role by email. */
export const findUserByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const email = data.email.trim().toLowerCase();
    const match = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
    return { user_id: match?.id ?? null, email: match?.email ?? null };
  });

/** Assign or unassign a Dispatch Zone Manager to a zone. */
export const setZoneAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; zone_id: string; assigned: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertManager(context);
    if (data.assigned) {
      const { error } = await context.supabase
        .from("zone_manager_assignments")
        .upsert({ user_id: data.user_id, zone_id: data.zone_id }, { onConflict: "user_id,zone_id" });
      if (error) throw error;
    } else {
      const { error } = await context.supabase
        .from("zone_manager_assignments")
        .delete()
        .eq("user_id", data.user_id)
        .eq("zone_id", data.zone_id);
      if (error) throw error;
    }
    return { ok: true };
  });

/** Admin/App Manager: send password reset email to a staff member. */
export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email);
    if (error) throw error;
    return { ok: true };
  });

/** List zones (for assignment UI). */
export const listZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context);
    const { data, error } = await context.supabase
      .from("dispatch_zones").select("id, code, name").order("sort_order");
    if (error) throw error;
    return { zones: data ?? [] };
  });

/** The caller's effective role set (client-side rendering hints). */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    return { roles: (data ?? []).map((r: any) => r.role as StaffRole) };
  });
