/**
 * PROVIDER DEMO FIXTURES — Master Admin Provider Preview only.
 *
 * Synthetic, in-memory data for invented Florida businesses. Never written to
 * any table, never read by live (non-preview) queries, never counted.
 *
 * SINGLE REMOVAL POINT: set PROVIDER_DEMO_ENABLED to false (or delete this
 * file and its one import in preview-data.tsx) to remove every provider demo.
 */
import type { SettlementRow } from "@/lib/network-settlements.functions";
import type { NetworkOffer, NetworkActivity, OfferSafeDetail } from "@/lib/trip-network.functions";
import type { LedgerRow } from "@/lib/provider-ops.functions";
import type { NetworkPaymentRow } from "@/lib/network-payments.functions";

export const PROVIDER_DEMO_ENABLED = true;
export const DEMO_NOTICE = "Preview only — no information was saved, sent or charged.";

const H = 3600e3, D = 86400e3;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const day = (offsetDays: number) => iso(offsetDays * D).slice(0, 10);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fee = (c: number) => Math.round(c * 0.02);

/* ---------- Fleet ---------- */
export const DEMO_DRIVERS = [
  { id: "preview-driver-1", first_name: "Dana", last_name: "Driverly (Demo)", phone: "(555) 010-0001", email: "dana.demo@example.com", status: "active", employment_type: "employee_w2", pay_type: "hourly", availability: { mode: "weekly", days: {} }, service_capabilities: ["wheelchair"], primary_vehicle_id: "preview-vehicle-1", contractor_pricing: {} },
  { id: "preview-driver-2", first_name: "Sam", last_name: "Sample (Demo)", phone: "(555) 010-0002", email: "", status: "active", employment_type: "independent_contractor", pay_type: "independent_contractor", availability: { mode: "flexible" }, service_capabilities: ["ambulatory"], primary_vehicle_id: null, contractor_pricing: {} },
  { id: "preview-driver-3", first_name: "Rae", last_name: "Retired (Demo)", phone: "(555) 010-0003", email: "", status: "inactive", employment_type: "employee_w2", pay_type: "hourly", availability: { mode: "flexible" }, service_capabilities: ["ambulatory"], primary_vehicle_id: null, contractor_pricing: {} },
];
export const DEMO_VEHICLES = [
  { id: "preview-vehicle-1", name: "Van 02 (Demo)", plate: "DEMO01", type: "wheelchair", capacity: 4, wheelchair_positions: 2, status: "active", assigned_driver_id: "preview-driver-1" },
  { id: "preview-vehicle-2", name: "Van 05 (Demo)", plate: "DEMO02", type: "ambulatory", capacity: 4, wheelchair_positions: 0, status: "active", assigned_driver_id: null },
];

/* ---------- Earnings ---------- */
export const DEMO_LEDGER: LedgerRow[] = [
  { id: "dl1", date: day(-1), driver: "Dana Driverly (Demo)", employment: "Employee", category: "payment", status: "paid", amountCents: 64000, reference: "Weekly pay DEMO" },
  { id: "dl2", date: day(-2), driver: "Sam Sample (Demo)", employment: "Contractor", category: "payment", status: "pending", amountCents: 41250, reference: "Contractor run DEMO" },
  { id: "dl3", date: day(-3), driver: "Dana Driverly (Demo)", employment: "Employee", category: "adjustment", status: "recorded", amountCents: 2500, reference: "Wait-time bonus DEMO" },
  { id: "dl4", date: day(-4), driver: "Sam Sample (Demo)", employment: "Contractor", category: "payment", status: "failed", amountCents: 18000, reference: "Returned payment DEMO" },
];
export function demoLedger(f: { start: string; end: string; driverId: string; category: string; status: string }) {
  const rows = DEMO_LEDGER.filter((r) => r.date >= f.start && r.date <= f.end && (f.category === "all" || r.category === f.category) && (f.status === "all" || r.status === f.status)
    && (!f.driverId || r.driver.startsWith(f.driverId === "preview-driver-1" ? "Dana" : "Sam")));
  return {
    rows,
    totals: { adjustmentsCents: rows.filter((r) => r.category === "adjustment").reduce((s, r) => s + r.amountCents, 0), paymentsCents: rows.filter((r) => r.category === "payment").reduce((s, r) => s + r.amountCents, 0) },
    workspaceMfn: "MFN-A-DEMO00",
    drivers: [{ id: "preview-driver-1", name: "Dana Driverly (Demo)" }, { id: "preview-driver-2", name: "Sam Sample (Demo)" }],
  };
}
const DRIVER_EARNINGS = { trips: { completed_count: 18, pickup_legs: 22, total_miles: 412, wait_minutes: 95, canceled_count: 1, worked_hours: 38, worked_days: 5 }, pay_type: "hourly", lines: [], gross_cents: 98000, adjustments_cents: 2500, amount_paid_cents: 64000, outstanding_cents: 36500, adjustments: [], payments: [] };

/* ---------- Network settlements (one per lifecycle state) ---------- */
function settlement(n: number, o: Partial<SettlementRow> & { payout: number }): SettlementRow {
  const nf = fee(o.payout); const proc = Math.ceil((o.payout + nf + 30) / (1 - 0.029)) - (o.payout + nf);
  return {
    id: uuid(n), mfn_id: `MFN-S-DEMO${String(n).padStart(2, "0")}`, source_mfn_id: `MFN-R-DEMO${n}`, side: "receiver",
    sender_workspace_mfn_id: "MFN-A-DEMO11", receiver_workspace_mfn_id: "MFN-A-DEMO00",
    receiver_payout_cents: o.payout, network_fee_cents: nf, processing_fee_cents: proc, processing_fee_rule: "sandbox_estimate_card",
    sender_total_due_cents: o.payout + nf + proc, currency: "usd", completed_at: iso(-2 * H), review_window_ends_at: null, payment_deadline_at: null,
    payment_succeeded_at: null, verification_tier_snapshot: null, hold_days: null, release_eligible_at: null, dispute_opened_at: null, dispute_resolved_at: null,
    transferred: false, paid_out: false, stripe_environment: "sandbox", state: "under_review", created_at: iso(-3 * D),
    events: [{ event_type: "referral_accepted", actor_mfn_id: "MFN-P-DEMO01", created_at: iso(-3 * D) }, { event_type: "completion_confirmed", actor_mfn_id: "MFN-P-DEMO02", created_at: iso(-2 * H) }],
    ...o,
  } as SettlementRow;
}
export const DEMO_SETTLEMENTS: SettlementRow[] = [
  settlement(1, { payout: 8500, state: "under_review", review_window_ends_at: iso(22 * H), payment_deadline_at: iso(4 * D) }),
  settlement(2, { payout: 9200, side: "sender", sender_workspace_mfn_id: "MFN-A-DEMO00", receiver_workspace_mfn_id: "MFN-A-DEMO12", state: "under_review", review_window_ends_at: iso(-2 * H), payment_deadline_at: iso(3 * D) }),
  settlement(3, { payout: 12000, state: "held", payment_succeeded_at: iso(-2 * D), verification_tier_snapshot: "verified", hold_days: 10, release_eligible_at: iso(8 * D) }),
  settlement(4, { payout: 15000, state: "held", payment_succeeded_at: iso(-1 * D), verification_tier_snapshot: "super_verified", hold_days: 4, release_eligible_at: iso(3 * D) }),
  settlement(5, { payout: 7800, state: "held", payment_succeeded_at: iso(-11 * D), verification_tier_snapshot: "verified", hold_days: 10, release_eligible_at: iso(-1 * D) }),
  settlement(6, { payout: 6400, state: "held", payment_succeeded_at: iso(-12 * D), verification_tier_snapshot: "verified", hold_days: 10, release_eligible_at: iso(-2 * D), transferred: true, transfer_status: "created", payout_status: "pending" }),
  settlement(7, { payout: 11000, state: "held", payment_succeeded_at: iso(-20 * D), verification_tier_snapshot: "super_verified", hold_days: 4, release_eligible_at: iso(-16 * D), transferred: true, paid_out: true, payout_status: "paid" }),
  settlement(8, { payout: 5600, state: "disputed", dispute_opened_at: iso(-5 * H) }),
  settlement(9, { payout: 4300, state: "failed" }),
];

export const DEMO_NETWORK_PAYMENTS: NetworkPaymentRow[] = [
  { id: uuid(41), mfn_id: "MFN-R-DEMO41", source_mfn_id: "MFN-A-DEMO11", completed_at: iso(-2 * H), due_at: iso(3 * D), initiated_at: null, paid_at: null, dispute_opened_at: null, dispute_resolved_at: null, state: "awaiting_completion" as never, can_complete: true, can_dispute: false, can_resolve: false },
];

/* ---------- Network offers & distributions ---------- */
const OFFER_IN: NetworkOffer = { id: uuid(21), mfn_id: "MFN-O-DEMO21", distribution_id: uuid(31), source_mfn_id: "MFN-A-DEMO11", service_type: "passenger_transportation", pickup_area: "Clearwater, Pinellas", destination_area: "St. Petersburg, Pinellas", pickup_date: day(2), pickup_time: "09:30:00", trip_type: "round_trip", estimated_miles: 14, amount_cents: 9500, capability: "Wheelchair", expires_at: iso(6 * H), status: "pending", provider_workspace_id: "preview-ws" };
const OFFER_COUNTER: NetworkOffer = { ...OFFER_IN, id: uuid(22), mfn_id: "MFN-O-DEMO22", pickup_area: "Tampa, Hillsborough", destination_area: "Brandon, Hillsborough", trip_type: "one_way", estimated_miles: 11, amount_cents: 7200, capability: "Ambulatory", status: "countered" };
export const DEMO_OFFERS: NetworkOffer[] = [OFFER_IN, OFFER_COUNTER];

export const DEMO_ACTIVITY: NetworkActivity[] = [
  { id: uuid(31), mfn_id: "MFN-D-DEMO31", source_mfn_id: "MFN-A-DEMO00", source_business: "Bayshore Mobility Co. (Demo)", pickup_area: "Largo, Pinellas", destination_area: "Tampa, Hillsborough", pickup_date: day(3), pickup_time: "13:00", capability: "Wheelchair", amount_cents: 11000, expires_at: iso(20 * H), status: "negotiating", current_radius: 20, can_manage: true,
    offers: [{ ...OFFER_COUNTER, id: uuid(32), mfn_id: "MFN-O-DEMO32", wave_id: "w1", status: "countered", amount_cents: 12500, provider_workspace_id: "demo-ws-a" }, { ...OFFER_IN, id: uuid(33), mfn_id: "MFN-O-DEMO33", wave_id: "w1", status: "declined", amount_cents: 11000, provider_workspace_id: "demo-ws-b" }],
    waves: [{ id: "w1", radius_miles: 20, sent_at: iso(-4 * H) }],
    negotiations: [{ id: "n1", offer_id: uuid(32), side: "sender", action: "offered", amount_cents: 11000, business_note: "Weekday afternoon pickup", created_at: iso(-4 * H) }, { id: "n2", offer_id: uuid(32), side: "receiver", action: "countered", amount_cents: 12500, business_note: "Longer wait expected", created_at: iso(-2 * H) }],
    events: [{ id: "e1", event_type: "distribution_created", created_at: iso(-5 * H), actor_mfn_id: "MFN-P-DEMO01" }, { id: "e2", event_type: "wave_sent", created_at: iso(-4 * H), actor_mfn_id: "MFN-P-DEMO01" }] },
  { id: uuid(34), mfn_id: "MFN-D-DEMO34", source_mfn_id: "MFN-A-DEMO00", source_business: "Bayshore Mobility Co. (Demo)", pickup_area: "Dunedin, Pinellas", destination_area: "Clearwater, Pinellas", pickup_date: day(1), pickup_time: "08:00", capability: "Ambulatory", amount_cents: 6800, expires_at: iso(-1 * H), status: "provider_selected", current_radius: 20, can_manage: false,
    offers: [{ ...OFFER_IN, id: uuid(35), mfn_id: "MFN-O-DEMO35", wave_id: "w2", status: "accepted", amount_cents: 6800, provider_workspace_id: "demo-ws-a" }],
    waves: [{ id: "w2", radius_miles: 20, sent_at: iso(-30 * H) }],
    negotiations: [{ id: "n3", offer_id: uuid(35), side: "receiver", action: "accepted", amount_cents: 6800, business_note: null, created_at: iso(-26 * H) }],
    events: [{ id: "e3", event_type: "offer_accepted", created_at: iso(-26 * H), actor_mfn_id: "MFN-P-DEMO03" }] },
];

export function demoOfferDetail(id: string): OfferSafeDetail {
  const o = [...DEMO_OFFERS, ...DEMO_ACTIVITY.flatMap((a) => a.offers)].find((x) => x.id === id) ?? OFFER_IN;
  const open = ["pending", "countered", "revised"].includes(o.status);
  return {
    offer_mfn_id: o.mfn_id, status: o.status, viewer: "receiver", distribution_stage_miles: 20, distribution_status: o.status === "accepted" ? "provider_selected" : "offers_sent",
    stages: [{ radius_miles: 20, sent_at: iso(-4 * H) }],
    versions: [{ side: "sender", action: "offered", amount_cents: o.amount_cents, created_at: iso(-4 * H) }, ...(o.status === "countered" ? [{ side: "receiver", action: "countered", amount_cents: o.amount_cents + 1300, created_at: iso(-2 * H) }] : [])],
    events: [{ event_type: "offer_sent", created_at: iso(-4 * H) }],
    latest_negotiation: o.status === "countered" ? { side: "receiver", action: "countered", amount_cents: o.amount_cents + 1300, created_at: iso(-2 * H) } : null,
    verification_tier: "super_verified", receiver_payout_cents: o.amount_cents, network_fee_cents: fee(o.amount_cents), processing_fee_rule: "sandbox_estimate_card",
    sender_total_before_processing_cents: o.amount_cents + fee(o.amount_cents), payment_ack_at: iso(-5 * H), accepted: o.status === "accepted",
    actions: { accept: open, counter: open, decline: open },
  };
}

export const DEMO_PROVIDERS = [
  { workspace_id: "demo-ws-a", business_name: "Gulfside Rides (Demo)", mfn_id: "MFN-A-DEMO01", description: "Wheelchair and ambulatory transportation across Pinellas. Demo listing.", cities: ["Clearwater", "Largo", "Dunedin"], counties: ["Pinellas"], zips: [], service_types: ["Wheelchair", "Ambulatory"], medical_delivery: false, accepting_connections: true, is_saved: true, business_contact_email: "", business_contact_phone: "", hours: "Mon–Fri 6:00 AM – 8:00 PM", verification_level: "gold" },
  { workspace_id: "demo-ws-b", business_name: "Suncoast Care Transit (Demo)", mfn_id: "MFN-A-DEMO02", description: "Stretcher and bariatric service for Hillsborough and Pasco. Demo listing.", cities: ["Tampa", "Brandon"], counties: ["Hillsborough", "Pasco"], zips: [], service_types: ["Stretcher", "Bariatric"], medical_delivery: true, accepting_connections: true, is_saved: false, business_contact_email: "", business_contact_phone: "", hours: "Daily 24 hours", verification_level: "blue" },
  { workspace_id: "demo-ws-c", business_name: "Palm Coast Mobility (Demo)", mfn_id: "MFN-A-DEMO03", description: "Ambulatory rides in Flagler and Volusia. Demo listing.", cities: ["Palm Coast", "Daytona Beach"], counties: ["Flagler", "Volusia"], zips: [], service_types: ["Ambulatory"], medical_delivery: false, accepting_connections: true, is_saved: false, business_contact_email: "", business_contact_phone: "", hours: "Mon–Sat 7:00 AM – 6:00 PM", verification_level: "semi" },
];

/** Query-key → fixture map consumed by preview-data.tsx (preview mode only). */
export const PROVIDER_DEMO_FIXTURES: Record<string, unknown> = PROVIDER_DEMO_ENABLED ? {
  drivers: DEMO_DRIVERS, vehicles: DEMO_VEHICLES,
  "driver-earnings": DRIVER_EARNINGS,
  "network-settlements": DEMO_SETTLEMENTS,
  "network-payments": DEMO_NETWORK_PAYMENTS,
  "network-offers": DEMO_OFFERS,
  "network-activity": DEMO_ACTIVITY,
  "network-providers": DEMO_PROVIDERS,
  "offer-history": [],
  "provider-balance-detailed": { balance: { available_cents: 7800, pending_cents: 27000, lifetime_paid_out_cents: 11000 }, entries: [], cashouts: [] },
} : {};

/** Keyed fixtures whose value depends on the second queryKey element. */
export function providerDemoKeyed(queryKey: readonly unknown[]): unknown | undefined {
  if (!PROVIDER_DEMO_ENABLED) return undefined;
  if (queryKey[0] === "offer-safe-detail") return demoOfferDetail(String(queryKey[1] ?? ""));
  if (queryKey[0] === "earnings-ledger") return demoLedger(queryKey[1] as never);
  return undefined;
}
