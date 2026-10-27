import { z } from 'zod';

export const personalSettingsInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(32),
  preferences: z.object({ in_app: z.boolean(), email: z.boolean() }).strict(),
}).strict();

/** Approximate straight-line distance, never a driving-distance promise. */
export function approximateMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (v: number) => v * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function serviceCompatibility(distance: number | null, radius: number | null, county: string | undefined, counties: string[]) {
  if (county && counties.some((v) => v.toLowerCase() === county.toLowerCase())) return 'Covered county';
  if (distance === null || radius === null) return 'Not confirmed';
  return distance <= radius ? 'Within service radius' : 'Outside service radius';
}

/** Fail-closed policy checks only; no grants, payment actions or badge writes.
 * Inputs must eventually come from authoritative workspace evidence, never forms.
 */
export const PROVIDER_VERIFICATION_POLICY = {
  membershipCents: 1500,
  trialDays: 30,
  goldTrips: 5,
  paymentBusinessDays: 3,
  disputeHours: 24,
} as const;

export type MembershipVerificationEvidence = {
  workspaceLinked: boolean;
  requiredMembership: boolean;
  environment: 'live' | 'sandbox';
  amountPaidCents: number;
  paymentStatus: 'succeeded' | 'pending' | 'failed' | 'refunded';
  subscriptionStatus: string;
  currentPeriodEnd: number | null;
  goodStanding: boolean;
};

export function qualifiesForSemiVerified(e: MembershipVerificationEvidence, now: number): boolean {
  return Number.isFinite(now) && e.workspaceLinked && e.requiredMembership && e.environment === 'live' &&
    (e.amountPaidCents === PROVIDER_VERIFICATION_POLICY.membershipCents || e.amountPaidCents === 2500) && e.paymentStatus === 'succeeded' &&
    e.subscriptionStatus === 'active' && e.goodStanding && e.currentPeriodEnd !== null && e.currentPeriodEnd > now;
}

export function qualifiesForBlueVerified(e: {
  semiVerified: boolean;
  profileComplete: boolean;
  servicesComplete: boolean;
  stripeBusinessVerified: boolean;
  stripePayoutsVerified: boolean;
  documents: readonly { applicable: boolean; required: boolean; present: boolean; businessNameMatches: boolean; expiresAt: number | null; expirationRequired: boolean }[];
  documentChecklistComplete: boolean;
}, now: number): boolean {
  return Number.isFinite(now) && e.semiVerified && e.profileComplete && e.servicesComplete &&
    e.stripeBusinessVerified && e.stripePayoutsVerified && e.documentChecklistComplete &&
    e.documents.filter((d) => d.applicable && d.required).every((d) => d.present && d.businessNameMatches &&
      (d.expiresAt !== null ? d.expiresAt > now : !d.expirationRequired));
}

export type NetworkVerificationPayment = {
  tripId: string;
  sentThroughNetwork: boolean;
  completedAt: number;
  completionInformationSubmitted: boolean;
  status: 'completed' | 'canceled' | 'declined' | 'refunded';
  test: boolean;
  demo: boolean;
  recipientPaidInFull: boolean;
  paymentFailed: boolean;
  initiatedAt: number | null;
  /** Calendar/deadline supplied by the authoritative obligation, not payout timing. */
  paymentDeadline: number | null;
};

export function qualifiesForGoldVerified(e: {
  blueVerified: boolean;
  obligationEvidenceComplete: boolean;
  overduePayments: boolean;
  activeDisputes: boolean;
  suspended: boolean;
  payments: readonly NetworkVerificationPayment[];
}): boolean {
  if (!e.blueVerified || !e.obligationEvidenceComplete || e.overduePayments || e.activeDisputes || e.suspended) return false;
  const eligible = e.payments.filter((p) => p.sentThroughNetwork && p.status === 'completed' &&
    !p.test && !p.demo && p.completionInformationSubmitted && Number.isFinite(p.completedAt))
    .sort((a, b) => b.completedAt - a.completedAt || a.tripId.localeCompare(b.tripId));
  const seen = new Set<string>();
  const latest = eligible.filter((p) => { if (seen.has(p.tripId)) return false; seen.add(p.tripId); return true; })
    .slice(0, PROVIDER_VERIFICATION_POLICY.goldTrips);
  return latest.length === PROVIDER_VERIFICATION_POLICY.goldTrips && latest.every((p) => p.recipientPaidInFull &&
    !p.paymentFailed && p.initiatedAt !== null && Number.isFinite(p.initiatedAt) && p.paymentDeadline !== null &&
    Number.isFinite(p.paymentDeadline) && p.initiatedAt >= p.completedAt && p.initiatedAt <= p.paymentDeadline);
}

export function isTimelyNetworkDispute(completedAt: number, submittedAt: number): boolean {
  return Number.isFinite(completedAt) && Number.isFinite(submittedAt) && submittedAt >= completedAt &&
    submittedAt - completedAt <= PROVIDER_VERIFICATION_POLICY.disputeHours * 60 * 60 * 1000;
}