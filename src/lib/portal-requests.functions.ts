import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Portal + admin request reads. Every read runs as the signed-in user, so the
 * database's row-level rules decide what is visible (own requests, workspace
 * requests where the member has explicit permission, or verified admin).
 * Unknown and unauthorized IDs return the same "not found" result.
 */

const LIST_COLS = "id, mfn_id, intake_source, trip_kind, transport_type, trip_type, status, network_status, created_at, submitted_via";
const DETAIL_COLS =
  "id, mfn_id, intake_source, trip_kind, transport_type, trip_type, status, network_status, created_at, submitted_via, pickup_date, pickup_time, appointment_time, pickup_address, pickup_address_details, pickup_city, dropoff_address, dropoff_city, round_trip, return_date, return_pickup_time, additional_stops, recurrence_rule, recurrence_end_date, patient_first_name, patient_last_name, patient_phone, patient_email, delivery_item_type, delivery_signature_required";

export type RequestListRow = {
  id: string; mfn_id: string | null; intake_source: string | null; trip_kind: string | null; transport_type: string | null; trip_type: string | null;
  status: string | null; network_status?: string | null; created_at: string; submitted_via: string | null;
};
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
export type RequestDetailRow = RequestListRow & { [k: string]: Json };

const idInput = (input: unknown) => z.object({ id: z.string().uuid() }).parse(input);
const NOT_FOUND = "not_found";

/** Never elevate this read: the same RLS boundary applies to every overlay entry point. */
export const getAuthorizedRequestDetail = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ kind: z.enum(['request', 'trip']), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const tripCols = 'id,display_id,ride_request_id,trip_kind,transport_type,status,network_status,created_at,pickup_date,pickup_time,appointment_time,pickup_address,pickup_address_details,pickup_city,dropoff_address,dropoff_city,round_trip,return_date,return_pickup_time,patient_first_name,patient_last_name,patient_phone,patient_email,network_provider_workspace_id,network_distribution_id';
    const { data: row, error } = data.kind === 'request'
      ? await context.supabase.from('ride_requests').select(DETAIL_COLS).eq('id', data.id).maybeSingle()
      : await context.supabase.from('trips').select(tripCols).eq('id', data.id).maybeSingle();
    if (error || !row) return { ok: false as const };
    const r = row as any;
    const { data: activity } = await context.supabase.rpc('network_list_activity');
    const distributions = Array.isArray(activity) ? activity as any[] : [];
    const relevant = distributions.filter(d => data.kind === 'request' ? d.request_id === data.id : d.trip_id === data.id);
    const requestId = data.kind === 'request' ? data.id : r.ride_request_id;
    const { data: storedHistory } = requestId ? await context.supabase.from('ride_request_history').select('action,created_at').eq('ride_request_id', requestId).order('created_at') : { data: [] };
    const history: { action: string; at: string; actor: string | null }[] = [
      { action: 'received', at: r.created_at, actor: null },
      ...(storedHistory || []).map(h => ({ action: h.action, at: h.created_at, actor: null })),
      ...relevant.flatMap(d => (d.events || []).map((e: any) => ({ action: String(e.event_type), at: String(e.created_at), actor: e.actor_mfn_id as string | null }))),
    ];
    let assignment: string | null = r.network_provider_workspace_id ? 'Provider selected' : null;
    if (r.network_provider_workspace_id) {
      const { data: ws } = await context.supabase.from('workspaces').select('mfn_id,display_name').eq('id', r.network_provider_workspace_id).maybeSingle();
      if (ws) assignment = [ws.display_name, ws.mfn_id].filter(Boolean).join(' · ');
    }
    return { ok: true as const, request: { ...r, mfn_id: r.mfn_id || r.display_id || null, trip_type: r.trip_type || (r.round_trip ? 'round_trip' : 'one_way'), intake_source: r.intake_source || null, submitted_via: r.submitted_via || null } as RequestDetailRow, assignment, history };
  });

async function requireAdmin(context: { supabase: any; userId: string }) {
  // Master Admin, or a regular admin granted Requests (row-level rules then limit to their account scope).
  const { data } = await context.supabase.rpc("admin_can", { _section: "requests", _level: "read" });
  if (!data) throw new Error("Forbidden");
}

export const getPortalSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ws } = await context.supabase
      .from("workspace_members")
      .select("role, workspaces!inner(display_name, account_type, status)")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    const w = (ws as any)?.workspaces;
    const { data: recent } = await context.supabase
      .from("ride_requests").select(LIST_COLS).order("created_at", { ascending: false }).limit(5);
    return {
      email: (context.claims as any)?.email ?? null,
      workspace: w ? { name: w.display_name as string | null, type: w.account_type as string, status: w.status as string, role: (ws as any).role as string } : null,
      recent: (recent ?? []) as RequestListRow[],
    };
  });

export const listPortalRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ride_requests").select(LIST_COLS).order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Could not load requests.");
    return (data ?? []) as RequestListRow[];
  });

export const getPortalRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("ride_requests").select(DETAIL_COLS).eq("id", data.id).maybeSingle();
    if (!row) return { ok: false as const, error: NOT_FOUND };
    return { ok: true as const, request: row as unknown as RequestDetailRow };
  });

export const listAdminRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("ride_requests").select(LIST_COLS).order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error("Could not load requests.");
    return (data ?? []) as RequestListRow[];
  });

export const getAdminRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: row } = await context.supabase.from("ride_requests").select(DETAIL_COLS).eq("id", data.id).maybeSingle();
    if (!row) return { ok: false as const, error: NOT_FOUND };
    return { ok: true as const, request: row as unknown as RequestDetailRow };
  });
