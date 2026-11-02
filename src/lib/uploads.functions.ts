import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rideRequestSchema, deliveryRequestSchema } from "@/lib/request-schemas";
import { CSV_MAX_ROWS } from "@/lib/csv-import";

/**
 * Upload Center. Uploads only ever create editable trip drafts owned by the
 * signed-in person — never requests, trips, provider choices, charges,
 * emails or distribution. Workspace comes from the session, never the browser.
 */
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const sourceType = z.enum(["csv", "xlsx", "pdf"]);

function summarize(p: Record<string, any>) {
  const name = [p.patientFirstName, p.patientLastName].filter(Boolean).join(" ");
  const route = [p.pickupCity, p.dropoffCity].filter(Boolean).join(" → ");
  const when = [p.pickupDate ?? p.requestedDate, p.pickupTime ?? p.requestedTime].filter(Boolean).join(" ");
  return [p.requestCategory === "medical_delivery" ? "Medical Delivery" : name || "Unnamed passenger", route, when, "Imported"].filter(Boolean).join(" · ").slice(0, 240);
}

export const prepareUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ sourceType, sourceHash: hash, byteSize: z.number().int().min(1).max(10 * 1024 * 1024) }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveUploadWorkspace, UPLOAD_BUCKET } = await import("@/lib/uploads.server");
    const ws = await resolveUploadWorkspace(supabaseAdmin, context.userId);
    const path = `${ws.workspaceId}/${crypto.randomUUID()}.${data.sourceType}`;
    const { data: signed, error } = await supabaseAdmin.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Upload could not start. Please try again.");
    const { data: row, error: e2 } = await supabaseAdmin.from("upload_originals").insert({
      workspace_id: ws.workspaceId, user_id: context.userId, storage_path: path, source_type: data.sourceType, source_hash: data.sourceHash, byte_size: data.byteSize,
    }).select("id").single();
    if (e2 || !row) throw new Error("Upload could not start. Please try again.");
    return { uploadId: row.id as string, path, token: signed.token };
  });

const rowsInput = z.object({
  kind: z.enum(["passenger", "delivery"]),
  sourceType,
  idempotencyKey: hash,
  uploadId: z.string().uuid().nullable(),
  patientId: z.string().uuid().nullable().optional(),
  rows: z.array(z.object({ row: z.number().int().min(1), data: z.unknown() })).min(1).max(CSV_MAX_ROWS),
  problems: z.array(z.object({ row: z.number().int().min(1), problems: z.array(z.string().max(200)).max(20) })).max(CSV_MAX_ROWS).default([]),
}).strict();

/** Create drafts from the rows the person explicitly confirmed. Same file → same key → no duplicates. */
export const createImportDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => rowsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveUploadWorkspace } = await import("@/lib/uploads.server");
    const ws = await resolveUploadWorkspace(supabaseAdmin, context.userId);
    const { data: existing } = await supabaseAdmin.from("csv_import_jobs").select("id, total_rows, draft_ids").eq("user_id", context.userId).eq("idempotency_key", data.idempotencyKey).maybeSingle();
    if (existing) return { duplicateFile: true, created: 0, total: existing.total_rows, failed: 0 };
    if (data.patientId) {
      const { data: p } = await supabaseAdmin.from("saved_patients").select("id").eq("id", data.patientId).eq("owner_id", context.userId).maybeSingle();
      if (!p) throw new Error("That patient profile isn't available.");
    }
    const { data: job, error } = await supabaseAdmin.from("csv_import_jobs").insert({
      user_id: context.userId, workspace_id: ws.workspaceId, kind: data.kind, idempotency_key: data.idempotencyKey, total_rows: data.rows.length,
      source_type: data.sourceType, actor_mfn_id: ws.actorMfnId, workspace_mfn_id: ws.workspaceMfnId,
      error_summary: data.problems as never, status: "processing",
    }).select("id").single();
    if (error || !job) throw new Error("Drafts could not be created. Please try again.");
    if (data.uploadId) await supabaseAdmin.from("upload_originals").update({ import_job_id: job.id }).eq("id", data.uploadId).eq("user_id", context.userId);

    const schema = data.kind === "passenger" ? rideRequestSchema : deliveryRequestSchema;
    const ids: string[] = [];
    let failed = 0;
    for (const r of data.rows) {
      // PDF assistance drafts may be partial; CSV/Excel rows must pass the request rules.
      const parsed = data.sourceType === "pdf" ? { success: true as const, data: r.data } : schema.safeParse(r.data);
      if (!parsed.success || !parsed.data || typeof parsed.data !== "object") { failed++; continue; }
      const payload = { ...(parsed.data as Record<string, unknown>), ...(data.kind === "delivery" ? { requestCategory: "medical_delivery" } : {}), ...(data.patientId ? { savedPatientId: data.patientId } : {}) };
      const { data: d, error: de } = await supabaseAdmin.from("trip_drafts").insert({
        user_id: context.userId, payload: payload as never, summary: summarize(payload), autosaved: false,
        import_job_id: job.id, import_row: r.row, workspace_id: ws.workspaceId, source: data.sourceType,
      }).select("id").single();
      if (de || !d) failed++; else ids.push(d.id);
    }
    await supabaseAdmin.from("csv_import_jobs").update({ submitted_rows: ids.length, failed_rows: failed, draft_ids: ids, status: "completed" }).eq("id", job.id);
    return { duplicateFile: false, created: ids.length, total: data.rows.length, failed };
  });

/** Safe history + opportunistic cleanup of this account's expired originals. */
export const listMyUploads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveUploadWorkspace, purgeExpiredOriginals } = await import("@/lib/uploads.server");
    let workspaceId: string | null = null;
    try { workspaceId = (await resolveUploadWorkspace(supabaseAdmin, context.userId)).workspaceId; } catch { return { available: false as const, jobs: [] }; }
    await purgeExpiredOriginals(supabaseAdmin, workspaceId);
    const { data: jobs } = await context.supabase.from("csv_import_jobs")
      .select("id, kind, source_type, total_rows, submitted_rows, failed_rows, status, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(25);
    const { data: originals } = await context.supabase.from("upload_originals").select("id, import_job_id, source_type, expires_at, deleted_at").eq("user_id", context.userId);
    return {
      available: true as const,
      jobs: (jobs ?? []).map((j) => {
        const o = (originals ?? []).find((x) => x.import_job_id === j.id);
        return { ...j, originalId: o && !o.deleted_at ? o.id : null, originalExpiresAt: o?.expires_at ?? null };
      }),
    };
  });

export const getUploadOriginalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ uploadId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("upload_originals").select("storage_path, expires_at, deleted_at").eq("id", data.uploadId).eq("user_id", context.userId).maybeSingle();
    if (!row || row.deleted_at || new Date(row.expires_at) < new Date()) return { error: "This original file has expired or isn't available." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { UPLOAD_BUCKET } = await import("@/lib/uploads.server");
    const { data: s } = await supabaseAdmin.storage.from(UPLOAD_BUCKET).createSignedUrl(row.storage_path, 60);
    return s ? { url: s.signedUrl } : { error: "This original file isn't available." };
  });
