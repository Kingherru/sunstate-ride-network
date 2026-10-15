import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rideRequestSchema, deliveryRequestSchema } from "@/lib/request-schemas";
import { CSV_MAX_ROWS } from "@/lib/csv-import";

/**
 * Staged CSV import. The workspace and owner come ONLY from the signed-in
 * session; CSV content is never stored — each confirmed row is re-validated
 * with the same schema and written through the shared insert path. A per-file
 * idempotency key stops refresh/resubmit duplicates. No emails are sent.
 */
export const importCsvRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    kind: z.enum(["passenger", "delivery"]),
    idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/),
    rows: z.array(z.object({ row: z.number().int().min(1), data: z.unknown() })).min(1).max(CSV_MAX_ROWS),
  }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: memberships } = await supabaseAdmin.from("workspace_members")
      .select("workspace_id, role, can_create_requests, is_contractor, workspaces!inner(status, account_type)")
      .eq("user_id", context.userId).eq("workspaces.status", "active");
    const ws = (memberships ?? []).filter((m: any) => m.workspaces.account_type !== "provider" && !m.is_contractor && (m.role === "owner" || m.role === "admin" || m.can_create_requests));
    if (ws.length !== 1) throw new Error("CSV import needs one active customer or organization account you can create requests for.");
    const workspaceId = ws[0].workspace_id;

    const { data: existing } = await supabaseAdmin.from("csv_import_jobs").select("*").eq("user_id", context.userId).eq("idempotency_key", data.idempotencyKey).maybeSingle();
    if (existing) return { duplicateFile: true, total: existing.total_rows, submitted: existing.submitted_rows, failed: existing.failed_rows, results: [] as { row: number; ok: boolean; mfnId?: string | null; reason?: string }[] };

    const { data: job, error: jobErr } = await supabaseAdmin.from("csv_import_jobs")
      .insert({ user_id: context.userId, workspace_id: workspaceId, kind: data.kind, idempotency_key: data.idempotencyKey, total_rows: data.rows.length })
      .select("id").single();
    if (jobErr || !job) throw new Error("Import could not start. Please try again.");

    const svc = await import("@/lib/requests/request-service.server");
    const schema = data.kind === "passenger" ? rideRequestSchema : deliveryRequestSchema;
    const results: { row: number; ok: boolean; mfnId?: string | null; reason?: string }[] = [];
    for (const r of data.rows) {
      const p = schema.safeParse(r.data);
      if (!p.success) { results.push({ row: r.row, ok: false, reason: "Failed validation" }); continue; }
      const own = { requesterUserId: context.userId, actorUserId: context.userId, workspaceId, submittedVia: "portal" as const, importJobId: job.id, skipNotify: true };
      const res = data.kind === "passenger"
        ? await svc.insertPassengerRequest(p.data as any, own)
        : await svc.insertDeliveryRequest(p.data as any, own);
      results.push(res.ok ? { row: r.row, ok: true, mfnId: res.mfnId } : { row: r.row, ok: false, reason: res.code === "23505" ? "Duplicate row in this file" : "Could not be saved" });
    }
    const submitted = results.filter((x) => x.ok).length;
    await supabaseAdmin.from("csv_import_jobs").update({ submitted_rows: submitted, failed_rows: results.length - submitted, status: "completed" }).eq("id", job.id);
    return { duplicateFile: false, total: data.rows.length, submitted, failed: results.length - submitted, results };
  });
