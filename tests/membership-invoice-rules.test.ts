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

const activeMembership = { status: 'active', trial_end: 900, current_period_end: 2000 };
const paidInvoice = { status: 'paid', paid: true, currency: 'usd', billing_reason: 'subscription_cycle' };

test('the approved $20 base payment qualifies', () => {
  expect(isQualifyingMembershipInvoice({ ...paidInvoice, amount_paid: 2000 }, activeMembership, 1000)).toBe(true);
});

test('the approved $30 base and Network payment qualifies', () => {
  expect(isQualifyingMembershipInvoice({ ...paidInvoice, amount_paid: 3000 }, activeMembership, 1000)).toBe(true);
});

test('a $10 Network add-on alone never qualifies', () => {
  expect(isQualifyingMembershipInvoice({ ...paidInvoice, amount_paid: 1000 }, activeMembership, 1000)).toBe(false);
});

test('a $50 course in the same invoice does not disqualify the $20 base', () => {
  expect(isQualifyingMembershipInvoice({ ...paidInvoice, amount_paid: 7000 }, activeMembership, 1000, 5000)).toBe(true);
});

test('both $50 courses in the same invoice do not disqualify the $30 recurring payment', () => {
  expect(isQualifyingMembershipInvoice({ ...paidInvoice, amount_paid: 13000 }, activeMembership, 1000, 10000)).toBe(true);
});

test('course payments cannot cover an unpaid base membership', () => {
  expect(isQualifyingMembershipInvoice({ ...paidInvoice, amount_paid: 6000 }, activeMembership, 1000, 5000)).toBe(false);
});

test('the legacy $25 base and add-on payment still qualifies', () => {
  expect(isQualifyingMembershipInvoice({ ...paidInvoice, amount_paid: 2500 }, activeMembership, 1000)).toBe(true);
});