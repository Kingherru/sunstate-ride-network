/** Pure launch-readiness builder (browser-safe). Inputs are booleans/amounts only — never secret values. */
export type ReadinessTone = "green" | "yellow" | "red";
export type ReadinessItem = { label: string; status: string; tone: ReadinessTone; note?: string };
export type ReadinessGroup = { title: string; items: ReadinessItem[] };

/** Every launch-controlled key the app reads. A missing row means OFF. */
export const LAUNCH_FLAG_KEYS = [
  { key: 'nearby_matching', label: 'Targeted nearby in-app offers' },
  { key: 'nearby_auto_waves', label: 'Automatic nearby waves' },
  { key: "network_live_settlement_collection", label: "Live Network settlement collection" },
  { key: "network_automatic_hold_release", label: "Automatic transfer / settlement after hold" },
  { key: "membership_renewal_transition", label: "Membership renewal transition" },
  { key: "driver_schedule_email", label: "Driver schedule emails" },
  { key: "auto_distribution", label: "Automatic trip distribution" },
  { key: "digital_guide_delivery", label: "Legacy digital-guide delivery" },
  { key: "communication_email_delivery", label: "External communication delivery" },
  { key: "patient_reminder_delivery", label: "Patient reminder delivery" },
  { key: "family_notification_delivery", label: "Family notification delivery" },
] as const;

export const MAIN_WEBHOOK_EVENTS = [
  "invoice.paid", "invoice.payment_failed", "customer.subscription.created", "customer.subscription.updated",
  "customer.subscription.deleted", "checkout.session.completed", "payment_intent.succeeded",
  "payment_intent.payment_failed", "payment_intent.canceled", "charge.refunded", "charge.dispute.created",
  "charge.dispute.closed", "transfer.created", "transfer.reversed",
] as const;
export const CONNECT_WEBHOOK_EVENTS = ["account.updated", "payout.paid", "payout.failed"] as const;
export const CONNECT_ENDPOINT_URL =
  "https://project--5cb17cca-6c98-4dc3-adf4-9afbd3550794-dev.lovable.app/api/public/payments/connect-webhook?env=sandbox";
export const CONNECT_SECRET_NAME = "STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET";

export type ReadinessInput = {
  prices: Record<string, number | null>; // lookup key -> sandbox cents (null = not found/inactive)
  liveTokenPresent: boolean;
  mainSecret: boolean;
  connectSecret: boolean;
  flags: Record<string, boolean>;
  placeholderPhone: boolean;
  testAccounts: { total: number; disabled: number };
  settlementLedger: boolean;
  connectedAccounts: number;
};

const price = (cents: number | null, want: number, label: string): ReadinessItem =>
  cents === want ? { label, status: `Ready — $${(want / 100).toFixed(2)} (test)`, tone: "green" }
    : cents == null ? { label, status: "Needs Attention — mapping unverified", tone: "red", note:'Owner action: verify sandbox price mapping before separately approving payment activation. No processor call performed.' }
    : { label, status: `Wrong amount — $${(cents / 100).toFixed(2)}`, tone: "red" };

const off = (label: string, on: boolean, note?: string): ReadinessItem =>
  on ? { label, status: "ON — needs review", tone: "red", note } : { label, status: "Prepared — OFF", tone: "yellow", note };

export function buildReadiness(i: ReadinessInput): ReadinessGroup[] {
  const f = (k: string) => i.flags[k] === true;
  return [
    { title: "Commerce", items: [
      price(i.prices.nemt_provider_base_monthly, 2000, "Base membership price (monthly)"),
      price(i.prices.nemt_network_addon_monthly, 1000, "Network add-on price (monthly)"),
      price(i.prices.course_nemt_v2, 5000, "Florida Basic NEMT Test course"),
      price(i.prices.course_hipaa_v2, 5000, "HIPAA Training for NEMT course"),
      price(i.prices.contractor_monthly,2000,'Independent Contractor membership'),
      price(i.prices.nemt_startup_guide_50,5000,'Provider-start guide'),
      { label: "Unified cart and checkout code", status: "Code ready", tone: "green" },
      { label: "Terms / checkout confirmation", status: "Code ready", tone: "green" },
      { label: "Live products and prices", status: i.liveTokenPresent ? "Live token present — not activated" : "Not activated (intentional)", tone: "yellow" },
    ] },
    { title: "Webhooks", items: [
      { label: "Main webhook route", status: "Code ready", tone: "green" },
      { label: "Main webhook signing secret", status: i.mainSecret ? "Configured" : "Missing", tone: i.mainSecret ? "green" : "red" },
      { label: "Main webhook test events", status: "Needs Attention — hosted mapping unverified", tone: "yellow", note: 'Owner action: verify required events. '+MAIN_WEBHOOK_EVENTS.join(", ") },
      { label: "Connected-account webhook route", status: "Code ready", tone: "green" },
      { label: "Connected-account signing secret", status: i.connectSecret ? "Configured" : "Owner action required", tone: i.connectSecret ? "green" : "yellow", note: i.connectSecret ? undefined : "Route answers 503 until the secret is saved." },
      { label: "Connected-account events", status: i.connectSecret ? "Confirm in Stripe Dashboard" : "Owner action required", tone: "yellow", note: CONNECT_WEBHOOK_EVENTS.join(", ") },
      { label: "Duplicate-event protection", status: "Code ready", tone: "green" },
    ] },
    { title: "Stripe Connect and settlement", items: [
      { label: "Provider onboarding / capability evidence", status: i.connectedAccounts > 0 ? `Code ready — ${i.connectedAccounts} linked (test)` : "Code ready — none linked", tone: i.connectedAccounts > 0 ? "green" : "yellow" },
      { label: "Settlement ledger", status: i.settlementLedger ? "Ready" : "Missing", tone: i.settlementLedger ? "green" : "red" },
      { label: "Standard hold", status: "Ready — 10 days", tone: "green" },
      { label: "Super Verified hold", status: "Ready — 4 days", tone: "green" },
      { label: "Dispute review window", status: "Ready — 24 hours", tone: "green" },
      { label: "Sender payment deadline", status: "Ready — 3 New York business days", tone: "green" },
      off("Live settlement collection", f("network_live_settlement_collection")),
      off("Automatic transfer / settlement", f("network_automatic_hold_release")),
      off("Automatic payouts and payout scheduler", false, "No payout code path exists; payouts stay on Stripe's standard schedule."),
      off("Membership renewal transition", f("membership_renewal_transition")),
      off("Automatic trip distribution", f("auto_distribution")),
    ] },
    { title: "Emails and notifications", items: [
      off("Driver schedule emails", f("driver_schedule_email")),
      ...LAUNCH_FLAG_KEYS.filter(k=>['digital_guide_delivery','communication_email_delivery','patient_reminder_delivery','family_notification_delivery'].includes(k.key)).map(k=>off(k.label,f(k.key),'Owner action: review and approve separately. Missing flags fail closed.')),
      off("Request / payment notifications", false, "In-app only; no outside sends are wired."),
      { label: "Real send test", status: "Not completed", tone: "yellow" },
    ] },
    { title: "Site and operations", items: [
      { label: "Publishing", status: "Not published by this pass", tone: "yellow", note: "Publish only after owner approval." },
      { label: "Public phone number", status: i.placeholderPhone ? "Placeholder — real number required" : "Set", tone: i.placeholderPhone ? "red" : "green" },
      { label: "Test accounts", status: i.testAccounts.disabled === i.testAccounts.total ? `All ${i.testAccounts.total} disabled` : `${i.testAccounts.total - i.testAccounts.disabled} of ${i.testAccounts.total} not disabled`, tone: i.testAccounts.disabled === i.testAccounts.total ? "green" : "red" },
      { label: "Browser, role and accessibility testing", status: "Deferred", tone: "yellow" },
      { label: "ACH settlement payments", status: "Off — setup pending", tone: "yellow" },
    ] },
  ];
}
