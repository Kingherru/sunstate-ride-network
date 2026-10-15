import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rideRequestSchema, deliveryRequestSchema } from "@/lib/request-schemas";

/**
 * Admin-on-behalf requests. The admin stays signed in as themselves; the
 * server verifies requests:manage + account scope, confirms the target person
 * really belongs to the chosen workspace, then uses the SAME insert path as
 * every other request. The admin is recorded as actor, the customer as requester.
 */
const target = z.object({ targetUserId: z.string().uuid(), workspaceId: z.string().uuid().nullable() });

async function authorize(context: any, t: z.infer<typeof target>) {
  const { requireAdminCan, adminCanAccount } = await import("@/lib/admin-guard.server");
  await requireAdminCan(context, "requests", "manage");
  if (!(await adminCanAccount(context, t.workspaceId))) throw new Error("That account isn't in your scope.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (t.workspaceId) {
    const { data: m } = await supabaseAdmin.from("workspace_members").select("user_id, workspaces!inner(status)")
      .eq("workspace_id", t.workspaceId).eq("user_id", t.targetUserId).maybeSingle();
    if (!m) throw new Error("That person isn't part of the selected account.");
  } else {
    const { data: p } = await supabaseAdmin.from("user_profiles").select("user_id").eq("user_id", t.targetUserId).maybeSingle();
    if (!p) throw new Error("Account not found.");
  }
}

async function audit(context: any, id: string, mfnId: string | null, t: z.infer<typeof target>) {
  await context.supabase.rpc("log_staff_action", {
    _action: "request_submitted_on_behalf", _target_kind: "ride_request", _target_id: id,
    _metadata: { request_mfn_id: mfnId, on_behalf_of_user_id: t.targetUserId, workspace_id: t.workspaceId },
  });
}

const FAIL = "We could not submit this request. Please check the details and try again.";

export const adminSubmitRideRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => target.extend({ request: rideRequestSchema }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { request, ...t } = data;
    await authorize(context, t);
    const svc = await import("@/lib/requests/request-service.server");
    const r = await svc.insertPassengerRequest(request, {
      requesterUserId: t.targetUserId, actorUserId: context.userId, workspaceId: t.workspaceId,
      submittedVia: "admin", onBehalfOfUserId: t.targetUserId,
    });
    if (!r.ok) return { ok: false as const, error: FAIL };
    await audit(context, r.id, r.mfnId, t);
    const { signEnrichmentToken } = await import("@/lib/enrichment-token.server");
    return { ok: true as const, id: r.id, mfnId: r.mfnId, enrichmentToken: signEnrichmentToken(r.id) };
  });

export const adminSubmitDeliveryRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => target.extend({ request: deliveryRequestSchema }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { request, ...t } = data;
    await authorize(context, t);
    const svc = await import("@/lib/requests/request-service.server");
    const r = await svc.insertDeliveryRequest(request, {
      requesterUserId: t.targetUserId, actorUserId: context.userId, workspaceId: t.workspaceId,
      submittedVia: "admin", onBehalfOfUserId: t.targetUserId,
    });
    if (!r.ok) return { ok: false as const, error: FAIL };
    await audit(context, r.id, r.mfnId, t);
    return { ok: true as const, id: r.id, mfnId: r.mfnId };
  });

export type OnBehalfCandidate = {
  userId: string; personMfnId: string | null; name: string;
  workspaceId: string | null; accountMfnId: string | null; accountName: string | null; accountType: string | null; isTest: boolean;
};

/** Customer/organization accounts the caller may submit for (scope-filtered server-side). */
export const listOnBehalfCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnBehalfCandidate[]> => {
    const { requireAdminCan } = await import("@/lib/admin-guard.server");
    await requireAdminCan(context, "requests", "manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: members }, { data: master }, { data: perms }, { data: scopes }] = await Promise.all([
      supabaseAdmin.from("workspace_members").select("user_id, role, workspaces!inner(id, mfn_id, display_name, account_type, status, is_test_account)").neq("workspaces.account_type", "provider"),
      context.supabase.rpc("is_master_admin", { _user_id: context.userId }),
      supabaseAdmin.from("admin_permissions").select("scope").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin.from("admin_permission_scopes").select("workspace_id").eq("admin_user_id", context.userId),
    ]);
    const allowed = (wsId: string) => master === true || perms?.scope === "all" || (perms?.scope === "selected" && (scopes ?? []).some((s) => s.workspace_id === wsId));
    const ids = [...new Set((members ?? []).map((m) => m.user_id))];
    const { data: profiles } = ids.length ? await supabaseAdmin.from("user_profiles").select("user_id, mfn_id, display_name").in("user_id", ids) : { data: [] as any[] };
    const pById = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    return (members ?? []).filter((m: any) => m.workspaces.status === "active" && allowed(m.workspaces.id)).map((m: any) => ({
      userId: m.user_id, personMfnId: pById.get(m.user_id)?.mfn_id ?? null, name: pById.get(m.user_id)?.display_name ?? "",
      workspaceId: m.workspaces.id, accountMfnId: m.workspaces.mfn_id, accountName: m.workspaces.display_name,
      accountType: m.workspaces.account_type, isTest: !!m.workspaces.is_test_account,
    }));
  });
