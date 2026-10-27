import { expect, test } from 'bun:test';
import { isQualifyingMembershipInvoice } from '../src/lib/membership-invoice-rules';
test('Semi requires an actual successful $15 USD membership invoice after trial, not checkout or fees', () => {
  const invoice = { status: 'paid', paid: true, currency: 'usd', amount_paid: 1500, billing_reason: 'subscription_cycle' };
  const sub = { status: 'active', trial_end: 900, current_period_end: 2000 };
  expect(isQualifyingMembershipInvoice(invoice, sub, 1000)).toBe(true);
  for (const patch of [{ paid: false }, { status: 'open' }, { amount_paid: 0 }, { amount_paid: 200 }, { currency: 'eur' }, { billing_reason: 'manual' }]) expect(isQualifyingMembershipInvoice({ ...invoice, ...patch }, sub, 1000)).toBe(false);
  expect(isQualifyingMembershipInvoice(invoice, { ...sub, status: 'trialing' }, 1000)).toBe(false);
  expect(isQualifyingMembershipInvoice(invoice, { ...sub, trial_end: 1001 }, 1000)).toBe(false);
  expect(isQualifyingMembershipInvoice(invoice, { ...sub, current_period_end: 1000 }, 1000)).toBe(false);
});