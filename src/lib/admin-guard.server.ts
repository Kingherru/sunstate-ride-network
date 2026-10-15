/** Server-side admin checks. Always run as the signed-in user so the database
 *  functions decide (Master Admin = everything; regular admins = granted sections + scope). */
export async function adminCan(context: any, section: string, level: "read" | "manage") {
  const { data } = await context.supabase.rpc("admin_can", { _section: section, _level: level });
  return data === true;
}
export async function requireAdminCan(context: any, section: string, level: "read" | "manage") {
  if (!(await adminCan(context, section, level))) throw new Error("You don't have permission to do this.");
}
export async function adminCanAccount(context: any, workspaceId: string | null) {
  const { data } = await context.supabase.rpc("admin_can_account", { _workspace_id: workspaceId as any });
  return data === true;
}
export async function requireMaster(context: any) {
  const { data } = await context.supabase.rpc("is_master_admin", { _user_id: context.userId });
  if (data !== true) throw new Error("Only the Master Admin can do this.");
}

/** Resolve the signed-in admin's account-visibility scope without per-row RPC calls.
 *  Returns { all: true } for Master Admin or scope='all' admins; otherwise the explicit
 *  list of workspace ids granted via admin_permission_scopes ('selected' scope never
 *  silently becomes 'all'). */
export async function getAdminWorkspaceScope(context: any): Promise<{ all: boolean; workspaceIds: string[] }> {
  const { data: isMaster } = await context.supabase.rpc("is_master_admin", { _user_id: context.userId });
  if (isMaster === true) return { all: true, workspaceIds: [] };
  const { data: perm } = await context.supabase
    .from("admin_permissions")
    .select("scope, active")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!perm?.active) return { all: false, workspaceIds: [] };
  if (perm.scope === "all") return { all: true, workspaceIds: [] };
  if (perm.scope !== "selected") return { all: false, workspaceIds: [] };
  const { data: scopes } = await context.supabase
    .from("admin_permission_scopes")
    .select("workspace_id")
    .eq("admin_user_id", context.userId);
  return { all: false, workspaceIds: (scopes ?? []).map((s: any) => s.workspace_id) };
}
