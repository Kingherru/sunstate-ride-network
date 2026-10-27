import { expect, test } from 'bun:test';
import { documentEvidenceStatus, qualifiesNetworkSettlement } from '../src/lib/verification-evidence-rules';
import { networkPaymentDeadline, effectiveNetworkPaymentState } from '../src/lib/network-payment-rules';
const now = Date.parse('2026-10-27T12:00:00Z');
const document = { applicable: true, exceptionAllowed: false, fileExists: true, privateBucket: true, businessName: 'Example Transport LLC', legalName: 'Example Transport', attested: true, effectiveDateRequired: true, expirationRequired: true, effectiveAt: now - 86400000, expiresAt: now + 31 * 86400000 };
test('Document requires protected file, matching business, attestation and applicable dates', () => {
  expect(documentEvidenceStatus(document, now)).toBe('Complete');
  for (const patch of [{ fileExists: false }, { privateBucket: false }, { attested: false }, { businessName: 'Other Company' }, { effectiveAt: null }, { expiresAt: null }]) expect(documentEvidenceStatus({ ...document, ...patch }, now)).toBe('Missing');
});
test('Documents expire and enter Expiring Soon within 30 days', () => {
  expect(documentEvidenceStatus({ ...document, expiresAt: now + 30 * 86400000 }, now)).toBe('Expiring Soon');
  expect(documentEvidenceStatus({ ...document, expiresAt: now - 1 }, now)).toBe('Expired');
});
test('Not Applicable is limited to permitted exceptions', () => {
  expect(documentEvidenceStatus({ ...document, applicable: false, exceptionAllowed: true, fileExists: false }, now)).toBe('Not Applicable');
  expect(documentEvidenceStatus({ ...document, applicable: false, exceptionAllowed: false, fileExists: false }, now)).toBe('Missing');
});
test('Network payment needs exact live obligation and recipient settlement evidence', () => {
  const evidence = { environment: 'live', linkedIntent: 'pi_fixture', intentId: 'pi_fixture', status: 'succeeded', currency: 'usd', received: 5000, expected: 5000, recipientAccount: 'acct_fixture', destination: 'acct_fixture', refunded: false, disputed: false };
  expect(qualifiesNetworkSettlement(evidence)).toBe(true);
  for (const patch of [{ environment: 'sandbox' }, { linkedIntent: 'pi_other' }, { destination: 'acct_other' }, { received: 4999 }, { refunded: true }, { disputed: true }, { status: 'processing' }]) expect(qualifiesNetworkSettlement({ ...evidence, ...patch })).toBe(false);
});
test('Lifecycle uses three New York business days across daylight saving and dispute pauses', () => {
  const completion = Date.parse('2026-10-30T16:00:00Z');
  expect(networkPaymentDeadline(completion)).toBe(Date.parse('2026-11-04T17:00:00Z'));
  expect(effectiveNetworkPaymentState({ state: 'due', dueAt: now - 1, initiatedAt: null, activeDispute: false }, now)).toBe('overdue');
  expect(effectiveNetworkPaymentState({ state: 'due', dueAt: now - 1, initiatedAt: null, activeDispute: true }, now)).toBe('disputed');
});