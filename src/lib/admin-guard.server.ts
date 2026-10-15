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
