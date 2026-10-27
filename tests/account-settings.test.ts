import { describe, expect, test } from 'bun:test';
import { personalSettingsInput, approximateMiles, serviceCompatibility, qualifiesForSemiVerified, qualifiesForBlueVerified, qualifiesForGoldVerified, isTimelyNetworkDispute, type NetworkVerificationPayment } from '../src/lib/account-settings-rules';
import { safeCsvCell, EXPORT_FIELDS } from '../src/lib/provider-export-rules';
describe('personal settings boundary', () => {
  const input = { firstName: 'Demo', lastName: 'Person', phone: '', preferences: { in_app: true, email: false } };
  test('names phone and notification preferences are editable', () => expect(personalSettingsInput.parse(input)).toEqual(input));
  test('role and account type cannot be changed through personal settings', () => {
    expect(personalSettingsInput.safeParse({ ...input, role: 'admin' }).success).toBe(false);
    expect(personalSettingsInput.safeParse({ ...input, account_type: 'provider' }).success).toBe(false);
  });
  test('security notices cannot be opted out through arbitrary preference keys', () => expect(personalSettingsInput.safeParse({ ...input, preferences: { ...input.preferences, security: false } }).success).toBe(false));
});
describe('private proximity', () => {
  test('straight-line miles are real and same point is zero', () => { expect(approximateMiles({ lat: 28, lng: -81 }, { lat: 29, lng: -81 })).toBeCloseTo(69.09, 1); expect(approximateMiles({ lat: 28, lng: -81 }, { lat: 28, lng: -81 })).toBe(0); });
  test('radius compatibility does not guess unknown centers', () => { expect(serviceCompatibility(20, 50, undefined, [])).toBe('Within service radius'); expect(serviceCompatibility(100, 50, undefined, [])).toBe('Outside service radius'); expect(serviceCompatibility(null, 50, undefined, [])).toBe('Not confirmed'); });
});
describe('safe dispatch exports', () => {
  test('CSV neutralizes spreadsheet formula injection', () => { expect(safeCsvCell('=1+1')).toBe('"\'=1+1"'); expect(safeCsvCell('A"B')).toBe('"A""B"'); });
  test('exports exclude patient medical and card fields', () => { expect(EXPORT_FIELDS.includes('pickup_date')).toBe(true); expect([...EXPORT_FIELDS]).not.toContain('diagnosis_code'); expect([...EXPORT_FIELDS]).not.toContain('card_number'); });
});

describe('approved verification policy — fail closed, no badge writes', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const membership = { workspaceLinked: true, requiredMembership: true, environment: 'live' as const, amountPaidCents: 1000, paymentStatus: 'succeeded' as const, subscriptionStatus: 'active', currentPeriodEnd: now + 86400000, goodStanding: true };
  test('only a successful $10 current membership qualifies, not the free trial or fees', () => {
    expect(qualifiesForSemiVerified(membership, now)).toBe(true);
    expect(qualifiesForSemiVerified({ ...membership, subscriptionStatus: 'trialing' }, now)).toBe(false);
    expect(qualifiesForSemiVerified({ ...membership, requiredMembership: false }, now)).toBe(false);
    expect(qualifiesForSemiVerified({ ...membership, amountPaidCents: 0 }, now)).toBe(false);
    expect(qualifiesForSemiVerified({ ...membership, amountPaidCents: 200 }, now)).toBe(false);
  });
  test('pending failed refunded sandbox unlinked expired and bad-standing membership never qualifies', () => {
    for (const paymentStatus of ['pending', 'failed', 'refunded'] as const) expect(qualifiesForSemiVerified({ ...membership, paymentStatus }, now)).toBe(false);
    expect(qualifiesForSemiVerified({ ...membership, environment: 'sandbox' }, now)).toBe(false);
    expect(qualifiesForSemiVerified({ ...membership, workspaceLinked: false }, now)).toBe(false);
    expect(qualifiesForSemiVerified({ ...membership, currentPeriodEnd: now }, now)).toBe(false);
    expect(qualifiesForSemiVerified({ ...membership, currentPeriodEnd: null }, now)).toBe(false);
    expect(qualifiesForSemiVerified({ ...membership, goodStanding: false }, now)).toBe(false);
  });
  const document = { applicable: true, required: true, present: true, businessNameMatches: true, expiresAt: now + 86400000, expirationRequired: true };
  const blue = { semiVerified: true, profileComplete: true, servicesComplete: true, stripeBusinessVerified: true, stripePayoutsVerified: true, documentChecklistComplete: true, documents: [document] };
  test('blue requires membership profile services and Stripe business/payout verification', () => {
    expect(qualifiesForBlueVerified(blue, now)).toBe(true);
    for (const key of ['semiVerified','profileComplete','servicesComplete','stripeBusinessVerified','stripePayoutsVerified','documentChecklistComplete'] as const) expect(qualifiesForBlueVerified({ ...blue, [key]: false }, now)).toBe(false);
  });
  test('missing removed expired mismatched required documents pause blue', () => {
    for (const d of [{ ...document, present: false }, { ...document, expiresAt: now }, { ...document, expiresAt: null }, { ...document, businessNameMatches: false }]) expect(qualifiesForBlueVerified({ ...blue, documents: [d] }, now)).toBe(false);
  });
  test('optional and inapplicable documents do not block blue; non-expiring W9 can qualify', () => {
    expect(qualifiesForBlueVerified({ ...blue, documents: [{ ...document, applicable: false, present: false }, { ...document, required: false, present: false }] }, now)).toBe(true);
    expect(qualifiesForBlueVerified({ ...blue, documents: [{ ...document, expirationRequired: false, expiresAt: null }] }, now)).toBe(true);
  });
  const payments: NetworkVerificationPayment[] = Array.from({ length: 5 }, (_, i) => ({ tripId: String(i), sentThroughNetwork: true, completedAt: now - i * 86400000, completionInformationSubmitted: true, status: 'completed', test: false, demo: false, recipientPaidInFull: true, paymentFailed: false, initiatedAt: now - i * 86400000 + 1000, paymentDeadline: now - i * 86400000 + 5000 }));
  const gold = { blueVerified: true, obligationEvidenceComplete: true, overduePayments: false, activeDisputes: false, suspended: false, payments };
  test('gold requires at least five distinct completed sent Network trips fully paid', () => {
    expect(qualifiesForGoldVerified(gold)).toBe(true);
    expect(qualifiesForGoldVerified({ ...gold, payments: payments.slice(0,4) })).toBe(false);
    expect(qualifiesForGoldVerified({ ...gold, payments: Array(5).fill(payments[0]) })).toBe(false);
    for (const patch of [{ sentThroughNetwork: false }, { completionInformationSubmitted: false }, { recipientPaidInFull: false }, { paymentFailed: true }, { test: true }, { demo: true }, { status: 'canceled' as const }, { status: 'declined' as const }, { status: 'refunded' as const }]) expect(qualifiesForGoldVerified({ ...gold, payments: [{ ...payments[0], ...patch }, ...payments.slice(1)] })).toBe(false);
  });
  test('latest five cannot cherry-pick older timely payments and deadline uses initiation not payout time', () => {
    expect(qualifiesForGoldVerified({ ...gold, payments: [{ ...payments[0], tripId: 'new', completedAt: now + 1, initiatedAt: now + 6000, paymentDeadline: now + 5000 }, ...payments] })).toBe(false);
    expect(qualifiesForGoldVerified({ ...gold, payments: payments.map(p => ({ ...p, initiatedAt: p.paymentDeadline })) })).toBe(true);
    expect(qualifiesForGoldVerified({ ...gold, payments: [{ ...payments[0], paymentDeadline: null }, ...payments.slice(1)] })).toBe(false);
  });
  test('overdue disputes suspension or incomplete evidence pause gold and clearing restores eligibility', () => {
    for (const patch of [{ blueVerified: false }, { obligationEvidenceComplete: false }, { overduePayments: true }, { activeDisputes: true }, { suspended: true }]) expect(qualifiesForGoldVerified({ ...gold, ...patch })).toBe(false);
    expect(qualifiesForGoldVerified(gold)).toBe(true);
  });
  test('disputes must be reported within exactly 24 hours of completion', () => {
    expect(isTimelyNetworkDispute(now, now + 86400000)).toBe(true);
    expect(isTimelyNetworkDispute(now, now + 86400001)).toBe(false);
    expect(isTimelyNetworkDispute(now, now - 1)).toBe(false);
  });
});