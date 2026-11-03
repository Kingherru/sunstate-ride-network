import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { normalizeSelection, commerceTotals, confirmationComplete } from './commerce-rules';
import { isQualifyingMembershipInvoice } from './membership-invoice-rules';

const c = (id: string) => ({ id, slug: id, title: id, price_cents: 5000, price_id: `k_${id}` });
const none = { ownedCourseIds: [], baseActive: false, addonActive: false };

describe('commerce rules', () => {
  it('add-on requires base membership', () => {
    expect(normalizeSelection({ base: false, network: true, courses: [] }, none).network).toBe(false);
    expect(normalizeSelection({ base: true, network: true, courses: [] }, none).network).toBe(true);
  });
  it('separates recurring and one-time totals', () => {
    const t = commerceTotals({ base: true, network: true, courses: [c('a'), c('b')] }, false);
    expect(t).toEqual({ recurringCents: 3000, oneTimeCents: 10000, dueTodayCents: 13000 });
    expect(commerceTotals({ base: true, network: false, courses: [c('a')] }, true).dueTodayCents).toBe(5000);
  });
  it('owned courses and duplicates are removed', () => {
    const r = normalizeSelection({ base: false, network: false, courses: [c('a'), c('a'), c('b')] }, { ...none, ownedCourseIds: ['b'] });
    expect(r.courses.map(x => x.id)).toEqual(['a']);
  });
  it('confirmation is required', () => {
    const sel = { base: true, network: false, courses: [c('a')] };
    expect(confirmationComplete(sel, { recurring: true, oneTime: false, terms: true })).toBe(false);
    expect(confirmationComplete(sel, { recurring: true, oneTime: true, terms: false })).toBe(false);
    expect(confirmationComplete(sel, { recurring: true, oneTime: true, terms: true })).toBe(true);
  });
  it('no access without paid invoice evidence; add-on alone never qualifies', () => {
    const sub = { status: 'active', trial_end: null, current_period_end: 2e9 };
    const inv = (amount: number, status = 'paid') => ({ status, paid: status === 'paid', currency: 'usd', amount_paid: amount, billing_reason: 'subscription_create' });
    expect(isQualifyingMembershipInvoice(inv(2000, 'open'), sub, 1e9)).toBe(false);
    expect(isQualifyingMembershipInvoice(inv(1000), sub, 1e9)).toBe(false);
    expect(isQualifyingMembershipInvoice(inv(2000), sub, 1e9)).toBe(true);
    expect(isQualifyingMembershipInvoice(inv(7000), sub, 1e9, 5000)).toBe(true);
    expect(isQualifyingMembershipInvoice(inv(2000), { ...sub, status: 'trialing', trial_end: 2e9 }, 1e9)).toBe(false);
  });
  it('grandfathering is absent from public copy', () => {
    const files = ['src/routes/terms.tsx', 'src/routes/join.tsx', 'src/routes/for-providers.tsx', 'src/lib/faq.ts', 'src/components/home/sections.tsx', 'src/components/training/TrainingCart.tsx', 'src/lib/membership-pricing.ts'];
    for (const f of files) expect(readFileSync(f, 'utf8').toLowerCase()).not.toMatch(/grandfather/);
  });
});
