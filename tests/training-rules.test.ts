import { describe, expect, it } from 'vitest';
import { eligibleCartItems, ownsEnrollment } from '../src/lib/training/cart-rules';
import { NEMT_QUESTIONS, NEMT_PASS_THRESHOLD } from '../src/lib/training/basic-nemt.server';
describe('Training ownership and source rules', () => {
  it('blocks another person from owning an enrollment', () => { expect(ownsEnrollment({ user_id: 'person-a' }, 'person-b')).toBe(false); expect(ownsEnrollment({ user_id: 'person-a' }, 'person-a')).toBe(true); });
  it('does not add owned courses', () => { expect(eligibleCartItems([{ id: 'a', slug: 'a', title: 'Course', price_id: 'existing', price_cents: 5000 }], ['a'])).toEqual([]); });
  it('does not duplicate cart items', () => { const c = { id: 'a', slug: 'a', title: 'Course', price_id: 'existing', price_cents: 5000 }; expect(eligibleCartItems([c, c], [])).toHaveLength(1); });
  it('requires an existing price mapping', () => { expect(eligibleCartItems([{ id: 'a', slug: 'a', title: 'Course', price_id: null, price_cents: 5000 }], [])).toEqual([]); });
  it('preserves the source 25 questions and 80 percent threshold', () => { expect(NEMT_QUESTIONS).toHaveLength(25); expect(NEMT_PASS_THRESHOLD).toBe(0.8); expect(20 / 25 >= NEMT_PASS_THRESHOLD).toBe(true); expect(19 / 25 >= NEMT_PASS_THRESHOLD).toBe(false); });
});