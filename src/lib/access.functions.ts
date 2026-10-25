import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessWorkspace = {
  id: string; type: string; status: "active" | "pending" | "suspended"; role: string;
  name: string | null; mfn_id: string | null; organization_type: string | null; is_contractor?: boolean;
};
export type PortalKind = "provider" | "customer";
export type AccessState = {
  isAdmin: boolean;
  restricted: boolean;
  isMasterAdmin: boolean;
  profileSuspended: boolean;
  mfnId: string | null;
  displayName: string | null;
  workspaces: AccessWorkspace[];
  /** The workspace the portal shows (first usable one). */
  primary: AccessWorkspace | null;
  portalKind: PortalKind;
  /** Any usable workspace membership where the user is owner/admin, or is a
   *  member explicitly flagged can_message_for_workspace. Additive — never
   *  used to grant anything beyond showing/blocking the Messaging nav item. */
  canMessageForWorkspace: boolean;
  setupIssue: string | null;
  destination: "/admin" | "/portal" | "/learn" | "/account-setup" | "/account-status";
};

/**
 * Server-verified access summary. Also finishes first-time account setup
 * (profile + workspace + owner membership + MFN IDs, atomically in the database).
 */
export const getAccessState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessState> => {
    let setupIssue: string | null = null;
    const setup = await context.supabase.rpc("complete_account_setup");
    if (setup.error) setupIssue = /organization_required/.test(setup.error.message) ? "organization_required" : /email_not_verified/.test(setup.error.message) ? "email_not_verified" : "setup_failed";

    const { data, error } = await context.supabase.rpc("my_access_state");
    if (error) throw new Error("Could not check account access.");
    const s = data as {
      is_admin: boolean; is_master_admin: boolean; profile_status: string | null; pending_type: string | null;
      mfn_id: string | null; display_name: string | null; workspaces: AccessWorkspace[];
    };
    const workspaces = s.workspaces ?? [];
    const { data: businessMemberships } = await context.supabase.from('workspace_members').select('workspace_id,record_permissions,can_manage_trips,is_contractor').eq('user_id',context.userId);
    const businessTools = new Set((businessMemberships??[]).filter(m=>!m.is_contractor && (m.can_manage_trips || Object.values(m.record_permissions as Record<string,string>).some(v=>v==='read'||v==='manage'))).map(m=>m.workspace_id));
    const profileSuspended = s.profile_status === "suspended";
    const usableList = workspaces.filter((w) => w.status !== "suspended");
    const primary = usableList[0] ?? null;
    // Provider tools only for a provider account; never from the business classification label.
    const portalKind: PortalKind = usableList.some((w) => w.type === "provider") ? "provider" : "customer";

    let destination: AccessState["destination"];
    if (profileSuspended) destination = "/account-status";
    else if (s.is_admin) destination = "/admin";
    else if (usableList.length) destination = "/portal";
    else if (workspaces.length > 0) destination = "/account-status";
    else if (s.pending_type) destination = "/account-setup";
    else destination = "/learn"; // training-only learner
    let canMessageForWorkspace = usableList.some((w) => w.role === "owner" || w.role === "admin");
    if (!canMessageForWorkspace) {
      const memberWorkspaces = usableList.filter((w) => w.role !== "owner" && w.role !== "admin");
      const checks = await Promise.all(
        memberWorkspaces.map((w) => context.supabase.rpc("can_access_workspace_messages", { ws: w.id })),
      );
      canMessageForWorkspace = checks.some((c) => c.data === true);
    }
    return {
      isAdmin: !!s.is_admin, isMasterAdmin: !!s.is_master_admin, profileSuspended,
      mfnId: s.mfn_id ?? null, displayName: s.display_name || null,
      workspaces, primary: portalKind === "provider" ? usableList.find((w) => w.type === "provider") ?? primary : primary,
      portalKind, setupIssue, destination, canMessageForWorkspace,
      // Contractor/restricted team member in every usable workspace: no business tools.
      restricted: usableList.length > 0 && usableList.every((w) => w.is_contractor || (w.role !== "owner" && w.role !== "admin" && !businessTools.has(w.id))),
    };
  });

/** Only same-site paths; blocks protocol-relative and backslash tricks. */
export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 300) return null;
  return raw;
}
