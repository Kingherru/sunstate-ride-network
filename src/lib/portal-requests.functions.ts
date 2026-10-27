import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Portal + admin request reads. Every read runs as the signed-in user, so the
 * database's row-level rules decide what is visible (own requests, workspace
 * requests where the member has explicit permission, or verified admin).
 * Unknown and unauthorized IDs return the same "not found" result.
 */

const LIST_COLS = "id, mfn_id, intake_source, trip_kind, transport_type, trip_type, status, network_status, created_at, submitted_via, patient_first_name, patient_last_name, pickup_city, dropoff_city, pickup_date, pickup_time, selected_provider_mfn_id";
const DETAIL_COLS =
  "id, mfn_id, lifecycle_state, deactivated_at, pickup_zip, dropoff_zip, intake_source, trip_kind, transport_type, trip_type, status, network_status, created_at, submitted_via, pickup_date, pickup_time, appointment_time, pickup_address, pickup_address_details, pickup_city, dropoff_address, dropoff_city, round_trip, return_date, return_pickup_time, return_dropoff_time, return_pickup_building, return_pickup_suite, additional_stops, recurrence_rule, recurrence_end_date, patient_first_name, patient_last_name, patient_phone, patient_email, requester_phone, requester_email, requester_user_id, workspace_id, assigned_provider_id, last_updated_at, canceled_at, needs_wheelchair, needs_assistance_to_vehicle, service_level, delivery_item_type, delivery_signature_required, delivery_instructions, special_instructions, mobility_notes,selected_provider_workspace_id,selected_provider_mfn_id,provider_selection_status,requester_workspace_mfn_id";

export type RequestListRow = {
  id: string; mfn_id: string | null; intake_source: string | null; trip_kind: string | null; transport_type: string | null; trip_type: string | null;
  status: string | null; network_status?: string | null; created_at: string; submitted_via: string | null;
  patient_first_name?: string | null; patient_last_name?: string | null;
  pickup_city?: string | null; dropoff_city?: string | null;
  pickup_date?: string | null; pickup_time?: string | null;
  selected_provider_mfn_id?: string | null;
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
    const tripCols = 'id,display_id,ride_request_id,trip_kind,transport_type,status,network_status,created_at,updated_at,pickup_date,pickup_time,appointment_time,pickup_address,pickup_address_details,pickup_city,dropoff_address,dropoff_city,round_trip,return_date,return_pickup_time,return_dropoff_time,return_pickup_building,return_pickup_suite,additional_stops,recurrence_rule,recurrence_end_date,service_level,needs_wheelchair,needs_assistance_to_vehicle,patient_first_name,patient_last_name,patient_phone,patient_email,network_provider_workspace_id,network_distribution_id,assigned_to';
    const { data: row, error } = data.kind === 'request'
      ? await context.supabase.from('ride_requests').select(DETAIL_COLS).eq('id', data.id).maybeSingle()
      : await context.supabase.from('trips').select(tripCols).eq('id', data.id).maybeSingle();
    if (error || !row) return { ok: false as const };
    let r = row as any;
    if (data.kind === 'trip' && r.ride_request_id) {
      // Linked form fields are merged only when this caller can also read the source request.
      const { data: source } = await context.supabase.from('ride_requests').select(DETAIL_COLS).eq('id', r.ride_request_id).maybeSingle();
      if (source) r = { ...source, ...r, trip_type: source.trip_type, submitted_via: source.submitted_via, intake_source: source.intake_source, workspace_id: source.workspace_id, requester_user_id: source.requester_user_id };
    }
    const { data: activity } = await context.supabase.rpc('network_list_activity');
    const distributions = Array.isArray(activity) ? activity as any[] : [];
    const relevant = distributions.filter(d => data.kind === 'request' ? d.request_id === data.id : d.trip_id === data.id);
    type DetailDistribution = { id: string; mfn_id: string; status: string; waves: { id: string; radius_miles: number; sent_at: string }[]; offers: { id: string; mfn_id: string; status: string; amount_cents: number }[]; negotiations: { id: string; side: string; action: string; amount_cents: number | null; created_at: string }[] };
    const detailDistributions: DetailDistribution[] = relevant.map(d => ({ id: String(d.id), mfn_id: String(d.mfn_id), status: String(d.status), waves: (d.waves || []).map((w: any) => ({ id: String(w.id), radius_miles: Number(w.radius_miles), sent_at: String(w.sent_at) })), offers: (d.offers || []).map((o: any) => ({ id: String(o.id), mfn_id: String(o.mfn_id), status: String(o.status), amount_cents: Number(o.amount_cents) })), negotiations: (d.negotiations || []).map((n: any) => ({ id: String(n.id), side: String(n.side), action: String(n.action), amount_cents: n.amount_cents == null ? null : Number(n.amount_cents), created_at: String(n.created_at) })) }));
    const requestId = data.kind === 'request' ? data.id : r.ride_request_id;
    const { data: storedHistory } = requestId ? await context.supabase.from('ride_request_history').select('action,created_at').eq('ride_request_id', requestId).order('created_at') : { data: [] };
    const history: { action: string; at: string; actor: string | null }[] = [
      { action: 'received', at: r.created_at, actor: null },
      ...(storedHistory || []).map(h => ({ action: h.action, at: h.created_at, actor: null })),
      ...relevant.flatMap(d => (d.events || []).map((e: any) => ({ action: String(e.event_type), at: String(e.created_at), actor: e.actor_mfn_id as string | null }))),
    ];
    let assignment: string | null = r.selected_provider_mfn_id ? `${r.selected_provider_mfn_id} · ${r.provider_selection_status} · booking unconfirmed` : r.network_provider_workspace_id ? 'Provider selected' : null;
    if (r.network_provider_workspace_id) {
      const { data: ws } = await context.supabase.from('workspaces').select('mfn_id,display_name').eq('id', r.network_provider_workspace_id).maybeSingle();
      if (ws) assignment = [ws.display_name, ws.mfn_id].filter(Boolean).join(' · ');
    }
    const { data: account } = r.workspace_id ? await context.supabase.from('workspaces').select('mfn_id,display_name,account_type').eq('id', r.workspace_id).maybeSingle() : { data: null };
    const selected = relevant.find(d => d.status === 'provider_selected');
    if (!assignment && selected) assignment = 'Provider selected';
    if (!assignment && (r.assigned_provider_id || r.assigned_to)) assignment = 'Assigned provider';
    const { data: requester } = r.requester_user_id ? await context.supabase.from('user_profiles').select('mfn_id,display_name').eq('user_id', r.requester_user_id).maybeSingle() : { data: null };
    return { ok: true as const, request: { ...r, ...(requester ? { requester_name: requester.display_name, requester_mfn_id: requester.mfn_id } : {}), additional_stops: Array.isArray(r.additional_stops) ? r.additional_stops.map((stop: any) => ({ address: String(stop.address || ''), city: String(stop.city || ''), pickupTime: String(stop.pickupTime || stop.pickup_time || '') })) : [], mfn_id: r.mfn_id || r.display_id || null, intake_source: r.intake_source || null, submitted_via: r.submitted_via || null } as RequestDetailRow, account, assignment, history, distributions: detailDistributions };
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
      .from("ride_requests").select(LIST_COLS).order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error("Could not load requests.");
    return (data ?? []) as RequestListRow[];
  });

const ACCEPTED_STATES = new Set(["accepted", "assigned", "in_progress", "completed", "provider_selected", "reserved"]);

/** Patient/Facility overview: accurate counts, recent requests, recent notifications.
 *  Every read runs as the signed-in user, so row-level rules scope the data. */
export const getCustomerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("ride_requests").select(LIST_COLS).order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error("Could not load requests.");
    const all = (rows ?? []) as RequestListRow[];
    const stateOf = (r: RequestListRow) => (r.network_status || r.status || "").toLowerCase();
    const counts = {
      sent: all.length,
      accepted: all.filter((r) => ACCEPTED_STATES.has(stateOf(r))).length,
      declined: all.filter((r) => stateOf(r) === "declined").length,
    };
    const { data: notes } = await context.supabase
      .from("notifications")
      .select("id, title, body, link, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(5);
    return { counts, recent: all.slice(0, 5), notifications: notes ?? [] };
  });

/** Copies an authorized request into a new editable draft. Never submits. */
export const copyRequestToDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("ride_requests").select(DETAIL_COLS).eq("id", data.id).maybeSingle();
    if (!row) return { ok: false as const, error: NOT_FOUND };
    const r = row as any;
    const delivery = r.trip_kind === "medical_delivery" || r.transport_type === "delivery";
    const payload = delivery
      ? {
          requestCategory: "medical_delivery",
          contactFirstName: r.patient_first_name ?? "", contactLastName: r.patient_last_name ?? "",
          contactPhone: r.patient_phone ?? "", contactEmail: r.patient_email ?? "",
          pickupAddress: r.pickup_address ?? "", pickupAddressDetails: r.pickup_address_details ?? "", pickupCity: r.pickup_city ?? "",
          dropoffAddress: r.dropoff_address ?? "", dropoffCity: r.dropoff_city ?? "",
          requestedDate: r.pickup_date ?? "", requestedTime: r.pickup_time ?? "",
          deliveryCategory: r.delivery_item_type ?? "", deliveryInstructions: r.delivery_instructions ?? "",
          signatureRequired: r.delivery_signature_required === true,
        }
      : {
          patientFirstName: r.patient_first_name ?? "", patientLastName: r.patient_last_name ?? "",
          patientPhone: r.patient_phone ?? "", patientEmail: r.patient_email ?? "",
          pickupAddress: r.pickup_address ?? "", pickupAddressDetails: r.pickup_address_details ?? "", pickupCity: r.pickup_city ?? "",
          pickupDate: "", pickupTime: "", appointmentTime: "",
          dropoffAddress: r.dropoff_address ?? "", dropoffCity: r.dropoff_city ?? "",
          transportType: r.transport_type ?? "ambulatory",
          tripType: r.trip_type ?? "one_way", roundTrip: r.trip_type === "round_trip",
          returnPickupTime: "", returnDropoffTime: "", returnDate: "",
          returnPickupBuilding: r.return_pickup_building ?? "", returnPickupSuite: r.return_pickup_suite ?? "",
          additionalStops: Array.isArray(r.additional_stops) ? r.additional_stops : [],
          mobilityNotes: r.mobility_notes ?? "", specialInstructions: r.special_instructions ?? "",
          recurrence: "none", recurrenceEndDate: "", billingSource: "account",
        };
    const name = [r.patient_first_name, r.patient_last_name].filter(Boolean).join(" ").trim();
    const summary = [delivery ? "Medical Delivery" : name || "Unnamed passenger", [r.pickup_city, r.dropoff_city].filter(Boolean).join(" → ")].filter(Boolean).join(" · ").slice(0, 240);
    const { data: created, error } = await context.supabase
      .from("trip_drafts")
      .insert({ user_id: context.userId, payload: payload as never, summary, autosaved: false })
      .select("id")
      .single();
    if (error) throw new Error("Could not copy this request.");
    return { ok: true as const, draftId: created.id as string };
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
