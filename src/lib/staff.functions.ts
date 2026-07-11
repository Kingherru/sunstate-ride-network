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
    if (isAppManager && data.role === "admin") {
      throw new Error("Permission denied: only administrators can grant the Administrator role.");
    }
    const { error } = await context.supabase
      .from("user_roles")
      .upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw error;
    await logAction(context, "role_granted", "user", data.user_id, { role: data.role });
    return { ok: true };
  });

/** Revoke a role from a user. App managers cannot revoke admin. */
export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; role: StaffRole }) => input)
  .handler(async ({ data, context }) => {
    const { isAppManager } = await assertManager(context);
    if (isAppManager && data.role === "admin") {
      throw new Error("Permission denied: only administrators can revoke the Administrator role.");
    }
    const { error } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    if (error) throw error;
    await logAction(context, "role_revoked", "user", data.user_id, { role: data.role });
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
    await logAction(context, data.assigned ? "zone_assigned" : "zone_unassigned", "user", data.user_id, {
      zone_id: data.zone_id,
    });
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
    await logAction(context, "password_reset_sent", "email", data.email, {});
    return { ok: true };
  });

/** Review a provider application (approve/deny). Any ops manager (admin/app_mgr/zone_mgr) may act. */
export const reviewProviderApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "approved" | "denied"; notes?: string }) => input)
  .handler(async ({ data, context }) => {
    const roles = await getCallerRoles(context);
    const allowed = ["admin", "app_manager", "zone_manager"] as StaffRole[];
    if (!roles.some((r) => allowed.includes(r))) {
      throw new Error("Permission denied: reviewing provider applications requires a manager role.");
    }
    const { error } = await context.supabase
      .from("provider_applications")
      .update({
        status: data.status,
        review_notes: data.notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw error;

    // On approval, sync application data → member_profiles for the matching
    // auth user (matched by email). This makes the Admin Portal show
    // company/city/region/ZIP/zone immediately after approval, and unlocks
    // the Provider Portal (no more onboarding wall) for the approved account.
    if (data.status === "approved") {
      try {
        const { data: app } = await context.supabase
          .from("provider_applications")
          .select("*")
          .eq("id", data.id)
          .maybeSingle();

        if (app?.email) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Find the auth user by email
          let match: any = null;
          let page = 1;
          const target = String(app.email).toLowerCase();
          while (!match) {
            const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
              page,
              perPage: 200,
            });
            if (listErr) break;
            match = (list?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === target);
            if (match) break;
            if (!list?.users?.length || list.users.length < 200) break;
            page += 1;
            if (page > 25) break;
          }

          if (match?.id) {
            // Resolve dispatch zone from ZIP if available
            let dispatch_zone_id: string | null = null;
            if (app.zip_code) {
              const { data: zoneId } = await supabaseAdmin.rpc("zone_id_for_zip", {
                _zip: app.zip_code,
              });
              dispatch_zone_id = (zoneId as any) ?? null;
            }

            const syncFields: Record<string, unknown> = {
              provider_application_id: app.id,
              company_name: app.company_name ?? null,
              first_name: app.first_name ?? null,
              last_name: app.last_name ?? null,
              phone: app.phone ?? null,
              dispatch_email: app.dispatch_email ?? app.email ?? null,
              city: app.city ?? null,
              region: app.region ?? "Statewide Florida",
              postal_code: app.zip_code ?? null,
              npi: app.npi ?? null,
            };
            if (dispatch_zone_id) syncFields.dispatch_zone_id = dispatch_zone_id;
            if (Array.isArray(app.preferred_zip_codes) && app.preferred_zip_codes.length) {
              syncFields.preferred_zip_codes = app.preferred_zip_codes;
            }

            // Upsert on user_id so a missing profile row is created too.
            await supabaseAdmin
              .from("member_profiles")
              .upsert({ user_id: match.id, ...syncFields }, { onConflict: "user_id" });
          }
        }
      } catch (syncErr) {
        // Sync failure must not block the approval itself.
        console.error("Provider approval sync failed", syncErr);
      }
    }

    // The DB trigger also logs; this call is a no-op safety net kept for clarity.
    return { ok: true };
  });

/** Recent audit log entries (admin & app_manager only). */
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number } = {}) => input)
  .handler(async ({ data, context }) => {
    await assertManager(context);
    const { data: rows, error } = await context.supabase
      .from("staff_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (error) throw error;
    return { entries: rows ?? [] };
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
