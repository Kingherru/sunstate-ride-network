/** Server-only helpers for the Patient/Facility Upload Center.
 *  Original files live in the private `import-uploads` bucket for 7 days.
 *  Removing an original never touches drafts, requests or audit rows. */
export const UPLOAD_BUCKET = "import-uploads";

/** Delete expired original files. Pass a workspace to limit scope (used when
 *  the Uploads page opens); omit it only from a future scheduled job. */
export async function purgeExpiredOriginals(admin: any, workspaceId?: string) {
  let q = admin.from("upload_originals").select("id, storage_path").is("deleted_at", null).lt("expires_at", new Date().toISOString()).limit(200);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);
  const { data } = await q;
  const rows = (data ?? []) as { id: string; storage_path: string }[];
  if (!rows.length) return 0;
  await admin.storage.from(UPLOAD_BUCKET).remove(rows.map((r) => r.storage_path));
  await admin.from("upload_originals").update({ deleted_at: new Date().toISOString() }).in("id", rows.map((r) => r.id));
  return rows.length;
}

/** The single active customer workspace the caller may create requests for. */
export async function resolveUploadWorkspace(admin: any, userId: string) {
  const { data } = await admin.from("workspace_members")
    .select("workspace_id, role, can_create_requests, is_contractor, workspaces!inner(status, account_type, mfn_id)")
    .eq("user_id", userId).is("removed_at", null).eq("workspaces.status", "active");
  const ws = (data ?? []).filter((m: any) => m.workspaces.account_type !== "provider" && !m.is_contractor && (m.role === "owner" || m.role === "admin" || m.can_create_requests));
  if (ws.length !== 1) throw new Error("Uploads need one active patient or facility account you can create requests for.");
  const { data: prof } = await admin.from("user_profiles").select("mfn_id").eq("user_id", userId).maybeSingle();
  return { workspaceId: ws[0].workspace_id as string, workspaceMfnId: (ws[0].workspaces.mfn_id ?? null) as string | null, actorMfnId: (prof?.mfn_id ?? null) as string | null };
}
