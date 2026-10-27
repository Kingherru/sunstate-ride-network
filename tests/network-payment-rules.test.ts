import { describe, expect, test } from 'bun:test';
import { networkPaymentDeadline, pausedPaymentDeadline, effectiveNetworkPaymentState, networkDisputeInput, isTimelyNetworkDispute } from '../src/lib/network-payment-rules';
describe('Network payment window', () => {
  test('Friday completion is due Wednesday at the same New York time', () => {
    expect(new Date(networkPaymentDeadline(Date.parse('2026-10-23T19:30:00Z'))).toISOString()).toBe('2026-10-28T19:30:00.000Z');
  });
  test('three business days use New York time across daylight saving change', () => {
    expect(new Date(networkPaymentDeadline(Date.parse('2026-10-30T19:30:00Z'))).toISOString()).toBe('2026-11-04T20:30:00.000Z');
    expect(new Date(networkPaymentDeadline(Date.parse('2027-03-12T20:30:00Z'))).toISOString()).toBe('2027-03-17T19:30:00.000Z');
  });
  test('payment is overdue only after the third business day deadline', () => {
    const e = { state: 'due' as const, dueAt: 1000, initiatedAt: null, activeDispute: false };
    expect(effectiveNetworkPaymentState(e, 1000)).toBe('due');
    expect(effectiveNetworkPaymentState(e, 1001)).toBe('overdue');
  });
  test('initiation is separate from Stripe settlement and transfer time', () => {
    expect(effectiveNetworkPaymentState({ state: 'due', dueAt: 1000, initiatedAt: 900, activeDispute: false }, 5000)).toBe('processing');
    expect(effectiveNetworkPaymentState({ state: 'failed', dueAt: 1000, initiatedAt: 900, activeDispute: false }, 5000)).toBe('overdue');
  });
  test('legitimate disputes have exactly a 24-hour initiation window', () => {
    expect(isTimelyNetworkDispute(1000, 86401000)).toBe(true);
    expect(isTimelyNetworkDispute(1000, 86401001)).toBe(false);
  });
  test('active dispute pauses overdue and resolution restores remaining time', () => {
    expect(effectiveNetworkPaymentState({ state: 'due', dueAt: 1000, initiatedAt: null, activeDispute: true }, 5000)).toBe('disputed');
    expect(pausedPaymentDeadline(1000, 500, 5500)).toBe(6000);
    expect(() => pausedPaymentDeadline(1000, 500, 499)).toThrow();
  });
  test('dispute action requires confirmation and rejects identity and payment overrides', () => {
    const input = { distributionId: '00000000-0000-4000-8000-000000000001', reason: 'amount_incorrect', confirmed: true };
    expect(networkDisputeInput.safeParse(input).success).toBe(true);
    expect(networkDisputeInput.safeParse({ ...input, confirmed: false }).success).toBe(false);
    expect(networkDisputeInput.safeParse({ ...input, paymentState: 'paid', workspaceId: input.distributionId }).success).toBe(false);
  });
});