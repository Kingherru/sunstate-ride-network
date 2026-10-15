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
    ctx.isAdmin = (roles ?? []).length > 0; // label only; on-behalf uses admin_can
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

/* ------------------------------------------------------------------ */
/* Shared inserts — the ONLY code that writes ride_requests rows.       */
/* Public form, portal, admin-on-behalf and CSV import all call these   */
/* after validating with the same zod schemas.                          */
/* ------------------------------------------------------------------ */
import type { RideRequestInput, DeliveryRequestInput } from "@/lib/request-schemas";

export type InsertOwnership = {
  requesterUserId: string | null;
  actorUserId: string | null;
  workspaceId: string | null;
  submittedVia: "public_form" | "portal" | "admin";
  onBehalfOfUserId?: string | null;
  importJobId?: string | null;
  /** CSV imports never email; test rows never email (decided by DB flag). */
  skipNotify?: boolean;
};
type InsertResult = { ok: true; id: string; mfnId: string | null; isTest: boolean } | { ok: false; code: string };

async function finish(row: any, error: any, category: RequestCategory, email: string | null, own: InsertOwnership, embedProviderId?: string | null): Promise<InsertResult> {
  if (error || !row) {
    console.error("request insert failed", error?.code ?? "unknown");
    return { ok: false, code: error?.code ?? "unknown" };
  }
  if (!row.is_test && !own.skipNotify) await notifyNewRequest({ id: row.id, category, requesterEmail: email, embedProviderId });
  return { ok: true, id: row.id, mfnId: row.mfn_id ?? null, isTest: !!row.is_test };
}

export async function insertPassengerRequest(data: RideRequestInput, own: InsertOwnership): Promise<InsertResult> {
  let embedProviderId: string | null = null;
  let embedTokenStored: string | null = null;
  if (data.embedToken) {
    const { data: tok } = await supabaseAdmin.from("provider_embed_tokens").select("provider_user_id, revoked_at").eq("token", data.embedToken).maybeSingle();
    if (tok && !tok.revoked_at) { embedProviderId = tok.provider_user_id; embedTokenStored = data.embedToken; }
  }
  const isRound = data.tripType === "round_trip" || data.roundTrip;
  const { error, data: row } = await supabaseAdmin.from("ride_requests").insert({
    trip_kind: "passenger",
    patient_first_name: data.patientFirstName, patient_last_name: data.patientLastName,
    patient_phone: data.patientPhone, patient_email: data.patientEmail || null,
    pickup_address: data.pickupAddress, pickup_address_details: data.pickupAddressDetails || null,
    pickup_city: data.pickupCity, pickup_date: data.pickupDate, pickup_time: data.pickupTime,
    appointment_time: data.appointmentTime || null,
    dropoff_address: data.dropoffAddress, dropoff_city: data.dropoffCity,
    transport_type: data.transportType, trip_type: data.tripType, round_trip: isRound,
    return_pickup_time: data.returnPickupTime || null, return_dropoff_time: data.returnDropoffTime || null,
    return_pickup_building: data.returnPickupBuilding || null, return_pickup_doctor: data.returnPickupDoctor || null,
    return_pickup_suite: data.returnPickupSuite || null,
    return_date: isRound ? (data.returnDate || data.pickupDate) : null,
    additional_stops: data.additionalStops ?? [],
    mobility_notes: data.mobilityNotes || null, special_instructions: data.specialInstructions || null,
    requester_user_id: own.requesterUserId, actor_user_id: own.actorUserId, workspace_id: own.workspaceId,
    submitted_via: own.submittedVia, on_behalf_of_user_id: own.onBehalfOfUserId ?? null, import_job_id: own.importJobId ?? null,
    recurrence_rule: data.recurrence && data.recurrence !== "none" ? data.recurrence : null,
    recurrence_end_date: data.recurrenceEndDate || null,
    embed_provider_id: embedProviderId, embed_token: embedTokenStored,
    trip_billing_source: data.billingSource,
    trip_billing_first_name: data.billingContact?.firstName ?? null, trip_billing_last_name: data.billingContact?.lastName ?? null,
    trip_billing_email: data.billingContact?.email ?? null, trip_billing_phone: data.billingContact?.phone ?? null,
  } as any).select("id, mfn_id, is_test").single();
  return finish(row, error, "passenger_transport", data.patientEmail || null, own, embedProviderId);
}

export async function insertDeliveryRequest(data: DeliveryRequestInput, own: InsertOwnership): Promise<InsertResult> {
  const { error, data: row } = await supabaseAdmin.from("ride_requests").insert({
    trip_kind: "medical_delivery", transport_type: "delivery", trip_type: "one_way", round_trip: false,
    patient_first_name: data.contactFirstName, patient_last_name: data.contactLastName,
    patient_phone: data.contactPhone, patient_email: data.contactEmail || null,
    requester_phone: data.contactPhone, requester_email: data.contactEmail || null,
    pickup_address: data.pickupAddress, pickup_address_details: data.pickupAddressDetails || null,
    pickup_city: data.pickupCity, pickup_date: data.requestedDate, pickup_time: data.requestedTime,
    dropoff_address: data.dropoffAddress, dropoff_city: data.dropoffCity,
    delivery_item_type: data.deliveryCategory, delivery_instructions: data.deliveryInstructions || null,
    delivery_signature_required: data.signatureRequired,
    requester_user_id: own.requesterUserId, actor_user_id: own.actorUserId, workspace_id: own.workspaceId,
    submitted_via: own.submittedVia, on_behalf_of_user_id: own.onBehalfOfUserId ?? null, import_job_id: own.importJobId ?? null,
  } as any).select("id, mfn_id, is_test").single();
  return finish(row, error, "medical_delivery", data.contactEmail || null, own);
}
