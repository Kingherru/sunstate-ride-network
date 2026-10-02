import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessWorkspace = { id: string; type: string; status: "active" | "pending" | "suspended"; role: string };
export type AccessState = {
  isAdmin: boolean;
  profileSuspended: boolean;
  workspaces: AccessWorkspace[];
  setupIssue: string | null;
  destination: "/admin" | "/portal" | "/learn" | "/account-setup" | "/account-status";
};

/**
 * Server-verified access summary. Also finishes first-time account setup
 * (profile + workspace + owner membership, atomically in the database).
 */
export const getAccessState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessState> => {
    let setupIssue: string | null = null;
    const setup = await context.supabase.rpc("complete_account_setup");
    if (setup.error) setupIssue = /organization_required/.test(setup.error.message) ? "organization_required" : /email_not_verified/.test(setup.error.message) ? "email_not_verified" : "setup_failed";

    const { data, error } = await context.supabase.rpc("my_access_state");
    if (error) throw new Error("Could not check account access.");
    const s = data as { is_admin: boolean; profile_status: string | null; pending_type: string | null; workspaces: AccessWorkspace[] };
    const workspaces = s.workspaces ?? [];
    const profileSuspended = s.profile_status === "suspended";
    const usable = workspaces.some((w) => w.status !== "suspended");

    let destination: AccessState["destination"];
    if (profileSuspended) destination = "/account-status";
    else if (s.is_admin) destination = "/admin";
    else if (usable) destination = "/portal";
    else if (workspaces.length > 0) destination = "/account-status";
    else if (s.pending_type) destination = "/account-setup";
    else destination = "/learn"; // training-only learner
    return { isAdmin: !!s.is_admin, profileSuspended, workspaces, setupIssue, destination };
  });

/** Only same-site paths; blocks protocol-relative and backslash tricks. */
export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 300) return null;
  return raw;
}
