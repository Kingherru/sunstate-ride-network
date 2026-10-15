import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessWorkspace = {
  id: string; type: string; status: "active" | "pending" | "suspended"; role: string;
  name: string | null; mfn_id: string | null; organization_type: string | null; is_contractor?: boolean;
};
export type PortalKind = "provider" | "customer";
export type AccessState = {
  isAdmin: boolean;
  isMasterAdmin: boolean;
  profileSuspended: boolean;
  mfnId: string | null;
  displayName: string | null;
  workspaces: AccessWorkspace[];
  /** The workspace the portal shows (first usable one). */
  primary: AccessWorkspace | null;
  portalKind: PortalKind;
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
    return {
      isAdmin: !!s.is_admin, isMasterAdmin: !!s.is_master_admin, profileSuspended,
      mfnId: s.mfn_id ?? null, displayName: s.display_name || null,
      workspaces, primary: portalKind === "provider" ? usableList.find((w) => w.type === "provider") ?? primary : primary,
      portalKind, setupIssue, destination,
      // Contractor/restricted team member in every usable workspace: no business tools.
      restricted: usableList.length > 0 && usableList.every((w) => w.is_contractor || (w.role !== "owner" && w.role !== "admin")),
    };
  });

/** Only same-site paths; blocks protocol-relative and backslash tricks. */
export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 300) return null;
  return raw;
}
