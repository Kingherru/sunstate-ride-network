import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Platform Requests: providers ask the platform team for help from Provider
 * Settings; admins with the messaging (support) permission reply and manage
 * status from Admin Messaging → Requests. Internal only — no external email.
 * Writes go through the service-role client only after access is verified.
 */

export const PLATFORM_REQUEST_CATEGORIES = [
  { value: "question", label: "Question" },
  { value: "account_issue", label: "Account issue" },
  { value: "technical_problem", label: "Technical problem" },
  { value: "trip_issue", label: "Trip issue" },
  { value: "payment_question", label: "Payment question" },
  { value: "verification_question", label: "Verification question" },
  { value: "feature_request", label: "Feature request" },
  { value: "other", label: "Other" },
] as const;

export const PLATFORM_REQUEST_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_for_provider", label: "Waiting for provider" },
  { value: "resolved", label: "Resolved" },
] as const;

const categoryEnum = z.enum(["question", "account_issue", "technical_problem", "trip_issue", "payment_question", "verification_question", "feature_request", "other"]);
const statusEnum = z.enum(["open", "in_progress", "waiting_for_provider", "resolved"]);

export type PlatformRequestRow = {
  id: string; mfn_id: string | null; workspace_id: string; workspace_name: string | null;
  submitted_by: string; submitter_name: string | null; category: string; subject: string;
  message: string; status: string; created_at: string; updated_at: string;
};
export type PlatformRequestEvent = {
  id: string; event_type: string; body: string | null; from_status: string | null; to_status: string | null;
  actor_name: string | null; created_at: string;
};

/** Workspace the provider may submit from (owner/admin of an active provider workspace). */
async function providerWorkspace(context: any, workspaceId: string) {
  const { data } = await context.supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, display_name, account_type, status)")
    .eq("workspace_id", workspaceId)
    .eq("user_id", context.userId)
    .is("removed_at", null)
    .maybeSingle();
  const ws = (data as any)?.workspaces;
  if (!data || !ws || ws.status !== "active") throw new Error("That workspace isn't available.");
  return ws;
}

const submitInput = z.object({
  workspaceId: z.string().uuid(),
  category: categoryEnum,
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(1).max(4000),
}).strict();

export const submitPlatformRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => submitInput.parse(i))
  .handler(async ({ data, context }) => {
    await providerWorkspace(context, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("platform_requests")
      .insert({ workspace_id: data.workspaceId, submitted_by: context.userId, category: data.category, subject: data.subject, message: data.message })
      .select("id, mfn_id")
      .single();
    if (error || !row) throw new Error("Could not submit that request.");
    await supabaseAdmin.from("platform_request_events").insert({ request_id: row.id, actor_user_id: context.userId, event_type: "created", body: data.message });
    return { ok: true as const, id: row.id as string, mfnId: row.mfn_id as string | null };
  });

/** Provider-side list: own workspace's requests (RLS-scoped read). */
export const listMyPlatformRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }): Promise<PlatformRequestRow[]> => {
    await providerWorkspace(context, data.workspaceId);
    const { data: rows, error } = await context.supabase
      .from("platform_requests")
      .select("id, mfn_id, workspace_id, submitted_by, category, subject, message, status, created_at, updated_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Could not load platform requests.");
    return (rows ?? []).map((r: any) => ({ ...r, workspace_name: null, submitter_name: null }));
  });

export const getPlatformRequestEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ requestId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }): Promise<PlatformRequestEvent[]> => {
    // RLS limits this to workspace members; admins use the admin variant below.
    const { data: rows, error } = await context.supabase
      .from("platform_request_events")
      .select("id, event_type, body, from_status, to_status, actor_user_id, created_at")
      .eq("request_id", data.requestId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error("Could not load request history.");
    return await withActorNames(context, rows ?? []);
  });

const replyInput = z.object({ requestId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).strict();

/** Provider reply on their own workspace's request. */
export const replyPlatformRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => replyInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: req } = await context.supabase
      .from("platform_requests").select("id, workspace_id, status").eq("id", data.requestId).maybeSingle();
    if (!req) throw new Error("That request isn't available.");
    await providerWorkspace(context, (req as any).workspace_id);
    if ((req as any).status === "resolved") throw new Error("This request is resolved.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_request_events")
      .insert({ request_id: data.requestId, actor_user_id: context.userId, event_type: "reply_provider", body: data.body });
    if (error) throw new Error("Could not send that reply.");
    await supabaseAdmin.from("platform_requests").update({ status: "open" }).eq("id", data.requestId).eq("status", "waiting_for_provider");
    return { ok: true as const };
  });

/* ---------------- Admin side (messaging/support permission) ---------------- */

async function requireSupport(context: any, level: "read" | "manage") {
  const { requireAdminCan } = await import("@/lib/admin-guard.server");
  await requireAdminCan(context, "messaging", level);
}

async function withActorNames(context: any, rows: any[]): Promise<PlatformRequestEvent[]> {
  const ids = Array.from(new Set(rows.map((r) => r.actor_user_id).filter(Boolean)));
  if (ids.length === 0) return rows.map((r) => ({ ...r, actor_name: null }));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profiles } = await supabaseAdmin.from("user_profiles").select("user_id, display_name").in("user_id", ids);
  const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name as string | null]));
  return rows.map((r) => ({ ...r, actor_name: map.get(r.actor_user_id) ?? null }));
}

export const listPlatformRequestsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformRequestRow[]> => {
    await requireSupport(context, "read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("platform_requests")
      .select("id, mfn_id, workspace_id, submitted_by, category, subject, message, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("Could not load platform requests.");
    const list = rows ?? [];
    const wsIds = Array.from(new Set(list.map((r: any) => r.workspace_id)));
    const userIds = Array.from(new Set(list.map((r: any) => r.submitted_by)));
    const [{ data: wss }, { data: profiles }] = await Promise.all([
      wsIds.length ? supabaseAdmin.from("workspaces").select("id, display_name").in("id", wsIds) : { data: [] as any[] },
      userIds.length ? supabaseAdmin.from("user_profiles").select("user_id, display_name").in("user_id", userIds) : { data: [] as any[] },
    ]);
    const wsMap = new Map((wss ?? []).map((w: any) => [w.id, w.display_name as string]));
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name as string | null]));
    return list.map((r: any) => ({ ...r, workspace_name: wsMap.get(r.workspace_id) ?? null, submitter_name: nameMap.get(r.submitted_by) ?? null }));
  });

export const getPlatformRequestEventsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ requestId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }): Promise<PlatformRequestEvent[]> => {
    await requireSupport(context, "read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("platform_request_events")
      .select("id, event_type, body, from_status, to_status, actor_user_id, created_at")
      .eq("request_id", data.requestId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error("Could not load request history.");
    return await withActorNames(context, rows ?? []);
  });

export const replyPlatformRequestAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => replyInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireSupport(context, "manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_request_events")
      .insert({ request_id: data.requestId, actor_user_id: context.userId, event_type: "reply_admin", body: data.body });
    if (error) throw new Error("Could not send that reply.");
    return { ok: true as const };
  });

export const setPlatformRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ requestId: z.string().uuid(), status: statusEnum }).strict().parse(i))
  .handler(async ({ data, context }) => {
    await requireSupport(context, "manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin.from("platform_requests").select("status").eq("id", data.requestId).maybeSingle();
    if (!current) throw new Error("That request isn't available.");
    if ((current as any).status === data.status) return { ok: true as const };
    const { error } = await supabaseAdmin.from("platform_requests").update({ status: data.status }).eq("id", data.requestId);
    if (error) throw new Error("Could not update the status.");
    await supabaseAdmin.from("platform_request_events").insert({
      request_id: data.requestId, actor_user_id: context.userId, event_type: "status_change",
      from_status: (current as any).status, to_status: data.status,
    });
    return { ok: true as const };
  });
