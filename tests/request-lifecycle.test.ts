import { describe, expect, it } from 'vitest';
import { adminNextStates, canTransition, noProviderDue } from '../src/lib/request-lifecycle';

describe('request lifecycle', () => {
  it('moves forward only through allowed steps', () => {
    expect(canTransition('submitted', 'in_review')).toBe(true);
    expect(canTransition('in_review', 'distributed')).toBe(true);
    expect(canTransition('accepted', 'completed')).toBe(true);
  });
  it('blocks skipping and backward changes', () => {
    expect(canTransition('submitted', 'completed')).toBe(false);
    expect(canTransition('submitted', 'accepted')).toBe(false);
    expect(canTransition('completed', 'in_review')).toBe(false);
    expect(canTransition('accepted', 'submitted')).toBe(false);
    expect(canTransition('cancelled', 'in_review')).toBe(false);
  });
  it('never lets an admin mark Provider Viewed', () => {
    expect(adminNextStates('distributed')).not.toContain('provider_viewed');
  });
  it('prepares No Provider Available after 24 hours', () => {
    const t = new Date('2026-10-27T12:00:00Z');
    expect(noProviderDue(t, new Date('2026-10-28T11:59:00Z'))).toBe(false);
    expect(noProviderDue(t, new Date('2026-10-28T12:00:00Z'))).toBe(true);
  });
});
