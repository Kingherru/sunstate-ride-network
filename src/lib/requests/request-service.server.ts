/**
 * Shared request service (server-only).
 *
 * One place that decides WHO is submitting a request and WHICH account it
 * belongs to. Authorization is derived only from the verified bearer token and
 * server-side workspace membership — never from client-supplied account IDs.
 * Used by public visitors today; signed-in Private Pay / Facility / Hospital /
 * Provider accounts, provider team members and MFN Admin (on-behalf) flows
 * will reuse it as portals are built.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RequestCategory = "passenger_transport" | "medical_delivery";

export type RequesterContext = {
  userId: string | null;
  /** Set only when the signed-in user belongs to exactly one active workspace. */
  workspaceId: string | null;
  isAdmin: boolean;
  /** Stored on ride_requests.submitted_via. */
  submittedVia: "public_form" | "portal" | "admin";
};

export async function resolveRequester(): Promise<RequesterContext> {
  const ctx: RequesterContext = { userId: null, workspaceId: null, isAdmin: false, submittedVia: "public_form" };
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return ctx;
    const { data } = await supabaseAdmin.auth.getUser(token);
    const uid = data.user?.id ?? null;
    if (!uid) return ctx;
    ctx.userId = uid;

    const [{ data: roles }, { data: memberships }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin"),
      supabaseAdmin
        .from("workspace_members")
        .select("workspace_id, role, can_create_requests, workspaces!inner(status)")
        .eq("user_id", uid)
        .eq("workspaces.status", "active"),
    ]);
    ctx.isAdmin = (roles ?? []).length > 0;
    // Only memberships allowed to create requests count; training-only
    // learners have none, so workspaceId stays null.
    const ws = (memberships ?? []).filter((m: any) => m.role === "owner" || m.role === "admin" || m.can_create_requests);
    if (ws.length === 1) ctx.workspaceId = ws[0].workspace_id;
    ctx.submittedVia = ctx.isAdmin ? "admin" : "portal";
  } catch {
    // Treat as anonymous; never leak the reason.
  }
  return ctx;
}

export function categoryLabel(c: RequestCategory) {
  return c === "medical_delivery" ? "Medical Delivery" : "Passenger Transportation";
}

/** Privacy-safe notifications: request number, status/category only. */
export async function notifyNewRequest(opts: {
  id: string;
  category: RequestCategory;
  requesterEmail?: string | null;
  embedProviderId?: string | null;
}) {
  const shortId = opts.id.slice(0, 8).toUpperCase();
  const notify = await import("@/lib/trips/notify.server");
  if (opts.requesterEmail) {
    try {
      await notify.sendTripEmail({
        templateName: "trip-confirmation",
        recipientEmail: opts.requesterEmail,
        idempotencyKey: `trip-confirmation:rr:${opts.id}`,
        templateData: { tripShortId: shortId, status: "Received — under review" },
      });
    } catch {
      console.error("request confirmation email failed");
    }
  }
  try {
    const templateData = { tripShortId: shortId, requestCategory: categoryLabel(opts.category) };
    let recipients: { email: string; name?: string; userId?: string }[] = [];
    if (opts.embedProviderId) {
      const t = await notify.getUserMailbox(opts.embedProviderId);
      if (t.email) recipients = [{ email: t.email, name: t.name ?? undefined, userId: opts.embedProviderId }];
    } else {
      recipients = (await notify.getStaffRecipients()).map((s) => ({ email: s.email, userId: s.userId }));
    }
    if (recipients.length) {
      await notify.fanOut({
        templateName: "staff-new-trip-review",
        recipients,
        baseIdempotencyKey: `staff-new-trip-review:rr:${opts.id}`,
        templateData,
      });
    }
  } catch {
    console.error("request staff notification failed");
  }
}
