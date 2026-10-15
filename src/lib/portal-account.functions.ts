import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ORGANIZATION_VALUES } from "@/lib/account-types";

/**
 * Change an account's business classification. Runs as the signed-in user, so
 * only owners/admins of that workspace pass row-level rules. The database
 * logs every change and blocks edits to account type, status and IDs.
 */
export const setOrganizationType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid(), type: z.enum(ORGANIZATION_VALUES) }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workspaces").update({ organization_type: data.type }).eq("id", data.workspaceId).select("id").maybeSingle();
    if (error || !row) throw new Error("You can't change this account's type.");
    return { ok: true };
  });

export type PersonRow = {
  userId: string; mfnId: string | null; name: string; email: string | null; emailVerified: boolean;
  roles: string[]; isMasterAdmin: boolean; needsReview: boolean; status: string;
  accounts: { id: string; mfnId: string | null; name: string | null; type: string; status: string; orgType: string; role: string }[];
  createdAt: string | null;
};

/** People & Accounts directory. Verified admins only. */
export const listPeopleAndAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersonRow[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, { data: members }, { data: master }, users] = await Promise.all([
      supabaseAdmin.from("user_profiles").select("user_id, mfn_id, display_name, legacy_review_needed, status, created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("workspace_members").select("user_id, role, workspaces!inner(id, mfn_id, display_name, account_type, status, organization_type)"),
      supabaseAdmin.from("platform_master_admin").select("user_id").maybeSingle(),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    const authById = new Map((users.data?.users ?? []).map((u) => [u.id, u]));
    return (profiles ?? []).map((p) => {
      const u = authById.get(p.user_id);
      return {
        userId: p.user_id, mfnId: p.mfn_id, name: p.display_name || "", email: u?.email ?? null,
        emailVerified: !!u?.email_confirmed_at,
        roles: (roles ?? []).filter((r) => r.user_id === p.user_id).map((r) => r.role as string),
        isMasterAdmin: master?.user_id === p.user_id,
        needsReview: p.legacy_review_needed && !(roles ?? []).some((r) => r.user_id === p.user_id), status: p.status as string,
        accounts: (members ?? []).filter((m) => m.user_id === p.user_id).map((m: any) => ({
          id: m.workspaces.id, mfnId: m.workspaces.mfn_id, name: m.workspaces.display_name, type: m.workspaces.account_type,
          status: m.workspaces.status, orgType: m.workspaces.organization_type, role: m.role,
        })),
        createdAt: p.created_at,
      };
    }).sort((a, b) => Number(b.isMasterAdmin) - Number(a.isMasterAdmin) || (a.mfnId ?? "").localeCompare(b.mfnId ?? ""));
  });
