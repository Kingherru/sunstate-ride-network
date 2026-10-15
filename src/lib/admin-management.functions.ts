import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADMIN_SECTION_KEYS, PRESETS } from "@/lib/admin-permissions";
import { ORGANIZATION_VALUES } from "@/lib/account-types";

/* ---------------- Regular-admin management (Master Admin only) ---------------- */

export type RegularAdmin = {
  userId: string; mfnId: string | null; name: string; email: string | null; isTest: boolean;
  preset: string; sections: Record<string, string>; scope: string; active: boolean; workspaceIds: string[];
};

export const listRegularAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireMaster } = await import("@/lib/admin-guard.server");
    await requireMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roles }, { data: master }, { data: perms }, { data: scopes }, { data: workspaces }, { data: audit }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      supabaseAdmin.from("platform_master_admin").select("user_id").maybeSingle(),
      supabaseAdmin.from("admin_permissions").select("*"),
      supabaseAdmin.from("admin_permission_scopes").select("*"),
      supabaseAdmin.from("workspaces").select("id, mfn_id, display_name, account_type, is_test_account").order("mfn_id"),
      supabaseAdmin.from("staff_audit_log").select("id, action, target_id, metadata, created_at, actor_user_id").or("action.like.admin_%,action.eq.user_role_changed").order("created_at", { ascending: false }).limit(50),
    ]);
    const ids = (roles ?? []).map((r) => r.user_id).filter((id) => id !== master?.user_id);
    const { data: profiles } = ids.length ? await supabaseAdmin.from("user_profiles").select("user_id, mfn_id, display_name, is_test_account").in("user_id", ids) : { data: [] as any[] };
    const emails = new Map<string, string | null>();
    for (const id of ids) { const { data } = await supabaseAdmin.auth.admin.getUserById(id); emails.set(id, data.user?.email ?? null); }
    const admins: RegularAdmin[] = ids.map((id) => {
      const p = (profiles ?? []).find((x: any) => x.user_id === id);
      const perm = (perms ?? []).find((x) => x.user_id === id);
      return {
        userId: id, mfnId: p?.mfn_id ?? null, name: p?.display_name ?? "", email: emails.get(id) ?? null, isTest: !!p?.is_test_account,
        preset: perm?.preset ?? "none", sections: (perm?.sections as any) ?? {}, scope: perm?.scope ?? "none", active: perm?.active ?? true,
        workspaceIds: (scopes ?? []).filter((s) => s.admin_user_id === id).map((s) => s.workspace_id),
      };
    });
    return { admins, workspaces: workspaces ?? [], audit: audit ?? [] };
  });

/** Promote an existing signed-up person (by email) to regular admin with NO access. */
export const promoteRegularAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ email: z.string().trim().email().max(320) }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { requireMaster } = await import("@/lib/admin-guard.server");
    await requireMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const u = (list?.users ?? []).find((x) => (x.email ?? "").toLowerCase() === data.email.toLowerCase());
    if (!u) throw new Error("No account found for that email. They must sign up first.");
    if (u.id === context.userId) throw new Error("You are already the Master Admin.");
    const { error } = await context.supabase.from("user_roles").insert({ user_id: u.id, role: "admin" });
    if (error && error.code !== "23505") throw new Error("Could not grant the administrator role.");
    await context.supabase.from("admin_permissions").upsert({ user_id: u.id, preset: "none", sections: {}, scope: "none", active: true }, { onConflict: "user_id", ignoreDuplicates: true });
    return { ok: true };
  });

const levels = z.enum(["none", "read", "manage"]);
export const setRegularAdminPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    preset: z.enum(["none", "support", "operations", "finance", "custom"]),
    sections: z.record(z.enum(ADMIN_SECTION_KEYS), levels),
    scope: z.enum(["none", "selected", "all"]),
    workspaceIds: z.array(z.string().uuid()).max(500),
    active: z.boolean(),
  }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { requireMaster } = await import("@/lib/admin-guard.server");
    await requireMaster(context);
    if (data.userId === context.userId) throw new Error("The Master Admin has full access and no permission row.");
    const sections = data.preset === "custom" ? data.sections : (PRESETS[data.preset] as Record<string, string>);
    const clean = Object.fromEntries(Object.entries(sections).filter(([, v]) => v !== "none"));
    const sb = context.supabase;
    const { data: isAdm } = await sb.rpc("holds_admin_label", { _user_id: data.userId });
    if (isAdm !== true) throw new Error("That person is not a regular admin.");
    const { error } = await sb.from("admin_permissions").upsert({ user_id: data.userId, preset: data.preset, sections: clean, scope: data.scope, active: data.active }, { onConflict: "user_id" });
    if (error) throw new Error("Permissions did not save.");
    const { data: cur } = await sb.from("admin_permission_scopes").select("workspace_id").eq("admin_user_id", data.userId);
    const want = data.scope === "selected" ? new Set(data.workspaceIds) : new Set<string>();
    const have = new Set((cur ?? []).map((r: any) => r.workspace_id));
    const add = [...want].filter((w) => !have.has(w)).map((w) => ({ admin_user_id: data.userId, workspace_id: w }));
    const del = [...have].filter((w) => !want.has(w));
    if (add.length) await sb.from("admin_permission_scopes").insert(add);
    if (del.length) await sb.from("admin_permission_scopes").delete().eq("admin_user_id", data.userId).in("workspace_id", del);
    return { ok: true };
  });

export const revokeRegularAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { requireMaster } = await import("@/lib/admin-guard.server");
    await requireMaster(context);
    if (data.userId === context.userId) throw new Error("The Master Admin can't be removed.");
    const sb = context.supabase;
    await sb.from("admin_permission_scopes").delete().eq("admin_user_id", data.userId);
    await sb.from("admin_permissions").delete().eq("user_id", data.userId);
    const { error } = await sb.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    if (error) throw new Error("Could not remove the administrator role.");
    return { ok: true };
  });

/** What the signed-in admin may open (Master Admin = everything). */
export const getMyAdminPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: master } = await context.supabase.rpc("is_master_admin", { _user_id: context.userId });
    const { data: perm } = await context.supabase.from("admin_permissions").select("sections, scope, active").eq("user_id", context.userId).maybeSingle();
    return { master: master === true, sections: (perm?.active ? (perm.sections as Record<string, string>) : {}) ?? {}, scope: perm?.active ? perm.scope : "none" };
  });

/* ---------------- Needs Review classification ---------------- */

export const CLASSIFY_VALUES = [...ORGANIZATION_VALUES, "provider", "training_only"] as const;

export const classifyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), type: z.enum(CLASSIFY_VALUES as unknown as [string, ...string[]]) }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { requireAdminCan, adminCanAccount } = await import("@/lib/admin-guard.server");
    await requireAdminCan(context, "classify", "manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("user_profiles").select("user_id, legacy_review_needed").eq("user_id", data.userId).maybeSingle();
    if (!profile) throw new Error("Account not found.");
    const { data: master } = await supabaseAdmin.from("platform_master_admin").select("user_id").maybeSingle();
    if (master?.user_id === data.userId) throw new Error("The Master Admin account can't be classified.");
    const { data: mem } = await supabaseAdmin.from("workspace_members").select("workspace_id, workspaces!inner(id, account_type, organization_type)").eq("user_id", data.userId);
    const existing = (mem ?? [])[0] as any;
    if (!(await adminCanAccount(context, existing?.workspace_id ?? null))) throw new Error("That account isn't in your scope.");
    let workspaceId: string | null = existing?.workspace_id ?? null;
    const before = existing ? { account_type: existing.workspaces.account_type, organization_type: existing.workspaces.organization_type } : null;

    if (data.type === "training_only") {
      if (existing) throw new Error("This person already has a business account; Training-Only doesn't apply.");
    } else if (existing) {
      if (existing.workspaces.account_type === "provider" || data.type === "provider") throw new Error("Provider accounts can't be switched here.");
      await supabaseAdmin.from("workspaces").update({ organization_type: data.type }).eq("id", existing.workspace_id);
    } else {
      // No account yet: create exactly one (never a duplicate). Pending; never verified-provider.
      const accountType = data.type === "provider" ? "provider" : data.type === "private_pay_patient" ? "private_pay" : data.type === "hospital" ? "hospital" : "facility";
      const { data: ws, error } = await supabaseAdmin.from("workspaces").insert({
        account_type: accountType, status: "pending", created_by: data.userId,
        organization_type: data.type === "provider" ? "transportation_provider" : data.type,
      } as any).select("id").single();
      if (error || !ws) throw new Error("Could not create the account.");
      workspaceId = ws.id;
      await supabaseAdmin.from("workspace_members").insert({ workspace_id: ws.id, user_id: data.userId, role: "owner" });
    }
    await supabaseAdmin.from("user_profiles").update({ legacy_review_needed: false }).eq("user_id", data.userId);
    await context.supabase.rpc("log_staff_action", {
      _action: "account_classified", _target_kind: "user", _target_id: data.userId,
      _metadata: { previous: before, new_type: data.type, workspace_id: workspaceId },
    });
    return { ok: true };
  });
