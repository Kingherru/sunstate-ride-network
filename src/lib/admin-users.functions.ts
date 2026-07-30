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
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  dispatch_email: string | null;
  dispatch_zone_id: string | null;
  dispatch_zone_name: string | null;
  dispatch_zone_code: string | null;
  provider_application_id: string | null;
  application_status: string | null;
  membership_status: string | null;
  membership_tier: string | null;
  vehicles_count: number;
  drivers_count: number;
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

    // Pull profile rows joined with dispatch zone for the Admin overview.
    const { data: profiles } = await supabaseAdmin
      .from("member_profiles")
      .select(
        "user_id, company_name, city, region, postal_code, phone, dispatch_email, dispatch_zone_id, provider_application_id, membership_status, membership_tier, dispatch_zones:dispatch_zone_id(name, code)",
      );

    // Pull application status keyed by id
    const appIds = (profiles ?? [])
      .map((p: any) => p.provider_application_id)
      .filter(Boolean);
    const appStatusMap = new Map<string, string>();
    if (appIds.length) {
      const { data: apps } = await supabaseAdmin
        .from("provider_applications")
        .select("id, status")
        .in("id", appIds);
      (apps ?? []).forEach((a: any) => appStatusMap.set(a.id, a.status));
    }

    // Vehicle & driver totals per owner (single query each, aggregated in JS)
    const { data: vehicleRows } = await supabaseAdmin
      .from("vehicles").select("owner_id");
    const { data: driverRows } = await supabaseAdmin
      .from("drivers").select("owner_id");
    const vehicleCounts = new Map<string, number>();
    (vehicleRows ?? []).forEach((v: any) => {
      vehicleCounts.set(v.owner_id, (vehicleCounts.get(v.owner_id) ?? 0) + 1);
    });
    const driverCounts = new Map<string, number>();
    (driverRows ?? []).forEach((d: any) => {
      driverCounts.set(d.owner_id, (driverCounts.get(d.owner_id) ?? 0) + 1);
    });

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
        const zone = p?.dispatch_zones ?? null;
        return {
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          portal,
          company_name: p?.company_name ?? null,
          city: p?.city ?? null,
          region: p?.region ?? null,
          state: "FL",
          postal_code: p?.postal_code ?? null,
          phone: p?.phone ?? null,
          dispatch_email: p?.dispatch_email ?? null,
          dispatch_zone_id: p?.dispatch_zone_id ?? null,
          dispatch_zone_name: zone?.name ?? null,
          dispatch_zone_code: zone?.code ?? null,
          provider_application_id: p?.provider_application_id ?? null,
          application_status: p?.provider_application_id
            ? appStatusMap.get(p.provider_application_id) ?? null
            : null,
          membership_status: p?.membership_status ?? null,
          membership_tier: p?.membership_tier ?? null,
          vehicles_count: vehicleCounts.get(u.id) ?? 0,
          drivers_count: driverCounts.get(u.id) ?? 0,
        };
      })
      // EXCLUDE patients — confidential, providers/facilities only
      .filter((u) => u.portal !== "patient")
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return result;
  });

async function assertAdmin(context: any) {
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

function primaryRoleFromState(portal: string | null, staffRoles: string[]): ManageableRole {
  // Highest privilege staff role wins for "primary role" display.
  const order: ManageableRole[] = ["admin", "app_manager", "zone_manager", "dispatcher"];
  for (const r of order) if (staffRoles.includes(r)) return r;
  if (portal === "patient" || portal === "provider" || portal === "facility") return portal;
  return "provider";
}

/** Admin-only: look up any user (including patients & staff) by email for role management. */
export const getUserRoleDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) =>
    z.object({ email: z.string().trim().email().max(320) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const target = data.email.toLowerCase();
    let match: any = null;
    let page = 1;
    while (!match) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      match = (list?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === target);
      if (match) break;
      if (!list?.users?.length || list.users.length < 200) break;
      page += 1;
      if (page > 25) break;
    }
    if (!match) throw new Error("No account found for that email.");

    const { data: roleRows } = await (context as any).supabase
      .from("user_roles").select("role").eq("user_id", match.id);
    const staffRoles = (roleRows ?? []).map((r: any) => r.role as string);
    const portal = (match.user_metadata?.portal as string) ?? null;
    return {
      user_id: match.id as string,
      email: (match.email as string) ?? null,
      portal,
      staff_roles: staffRoles,
      current_role: primaryRoleFromState(portal, staffRoles),
    };
  });

/**
 * Admin-only: set a user's primary role. Portal roles (patient/provider/facility)
 * update user_metadata.portal and revoke all staff roles. Staff roles (dispatcher/
 * zone_manager/app_manager/admin) replace existing staff roles and leave portal intact.
 * Change is written to staff_audit_log.
 */
export const setUserPrimaryRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; role: ManageableRole }) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(MANAGEABLE_ROLES),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === (context as any).userId && data.role !== "admin") {
      throw new Error("You cannot remove your own Administrator role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = (context as any).supabase;

    // Snapshot previous state
    const { data: userRes, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (getErr || !userRes?.user) throw new Error("User not found.");
    const prevPortal = (userRes.user.user_metadata?.portal as string) ?? null;
    const { data: prevRoleRows } = await sb.from("user_roles").select("role").eq("user_id", data.user_id);
    const prevStaff = (prevRoleRows ?? []).map((r: any) => r.role as string);
    const prevRole = primaryRoleFromState(prevPortal, prevStaff);

    if (PORTAL_ROLES.includes(data.role)) {
      // Update portal + clear all staff roles
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        user_metadata: { ...(userRes.user.user_metadata ?? {}), portal: data.role },
      });
      if (updErr) throw updErr;
      const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      if (delErr) throw delErr;
    } else if (STAFF_ROLES.includes(data.role)) {
      // Replace staff roles with the single selected staff role
      const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role as "dispatcher" | "zone_manager" | "app_manager" | "admin" });
      if (insErr) throw insErr;
    }

    await sb.rpc("log_staff_action", {
      _action: "user_role_changed",
      _target_kind: "user",
      _target_id: data.user_id,
      _metadata: {
        email: userRes.user.email,
        previous_role: prevRole,
        previous_portal: prevPortal,
        previous_staff_roles: prevStaff,
        new_role: data.role,
      },
    });

    return { ok: true, previous_role: prevRole, new_role: data.role };
  });


/* ------------------------------------------------------------------ */
/* Test dispatch account (Admin Portal → Users)                        */
/* ------------------------------------------------------------------ */

export const TEST_DISPATCH_EMAIL = "dispatch.test@myfloridanemt.com";

function randomPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return (
    "Dx!" +
    Array.from(bytes, (b) => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 56]).join("")
  );
}

/** Admin-only: read the state of the shared test dispatcher account. */
export const getTestDispatchAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let match: any = null;
    let page = 1;
    while (!match) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      match = (list?.users ?? []).find(
        (u: any) => (u.email ?? "").toLowerCase() === TEST_DISPATCH_EMAIL,
      );
      if (match) break;
      if (!list?.users?.length || list.users.length < 200) break;
      page += 1;
      if (page > 25) break;
    }
    if (!match) return { exists: false as const, email: TEST_DISPATCH_EMAIL };
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", match.id);
    return {
      exists: true as const,
      email: TEST_DISPATCH_EMAIL,
      user_id: match.id as string,
      last_sign_in_at: (match.last_sign_in_at as string | null) ?? null,
      roles: (roleRows ?? []).map((r: any) => r.role as string),
    };
  });

/**
 * Admin-only: create (or reset the password of) a test account that holds the
 * Dispatcher role, so the full dispatch workflow can be exercised end to end.
 * The generated password is returned once and never stored in plain text.
 */
export const provisionTestDispatchAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = randomPassword();

    // Find existing
    let match: any = null;
    let page = 1;
    while (!match) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      match = (list?.users ?? []).find(
        (u: any) => (u.email ?? "").toLowerCase() === TEST_DISPATCH_EMAIL,
      );
      if (match) break;
      if (!list?.users?.length || list.users.length < 200) break;
      page += 1;
      if (page > 25) break;
    }

    let userId: string;
    let created = false;
    if (match) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(match.id, {
        password,
        email_confirm: true,
        user_metadata: { ...(match.user_metadata ?? {}), portal: "staff", test_account: true },
      });
      if (error) throw error;
      userId = match.id;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: TEST_DISPATCH_EMAIL,
        password,
        email_confirm: true,
        user_metadata: {
          portal: "staff",
          test_account: true,
          first_name: "Test",
          last_name: "Dispatcher",
        },
      });
      if (error) throw error;
      userId = data.user!.id;
      created = true;
    }

    // Ensure exactly the dispatcher staff role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles").insert({ user_id: userId, role: "dispatcher" });
    if (roleErr) throw roleErr;

    await (context as any).supabase.rpc("log_staff_action", {
      _action: created ? "test_dispatch_account_created" : "test_dispatch_account_reset",
      _target_kind: "user",
      _target_id: userId,
      _metadata: { email: TEST_DISPATCH_EMAIL },
    });

    return { email: TEST_DISPATCH_EMAIL, password, user_id: userId, created, login_url: "/staff/login" };
  });

/** Admin-only: remove the test dispatcher account entirely. */
export const deleteTestDispatchAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let match: any = null;
    let page = 1;
    while (!match) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      match = (list?.users ?? []).find(
        (u: any) => (u.email ?? "").toLowerCase() === TEST_DISPATCH_EMAIL,
      );
      if (match) break;
      if (!list?.users?.length || list.users.length < 200) break;
      page += 1;
      if (page > 25) break;
    }
    if (!match) return { ok: true, removed: false };
    await supabaseAdmin.from("user_roles").delete().eq("user_id", match.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(match.id);
    if (error) throw error;
    await (context as any).supabase.rpc("log_staff_action", {
      _action: "test_dispatch_account_deleted",
      _target_kind: "user",
      _target_id: match.id,
      _metadata: { email: TEST_DISPATCH_EMAIL },
    });
    return { ok: true, removed: true };
  });

/**
 * Admin/ops-only: set a member's membership tier + status.
 * Runs through the `admin_set_membership` SQL function, which re-verifies the
 * caller's staff role and writes to the staff audit log.
 */
export const setMemberMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        tier: z.enum(["none", "free", "paid"]),
        status: z.enum(["active", "inactive", "canceled", "past_due"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context as any).supabase.rpc("admin_set_membership", {
      _user_id: data.user_id,
      _tier: data.tier,
      _status: data.status ?? (data.tier === "none" ? "inactive" : "active"),
    });
    if (error) throw new Error(error.message);
    return { ok: true, user_id: data.user_id, tier: data.tier };
  });
