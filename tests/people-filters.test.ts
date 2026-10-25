import { expect, it } from 'vitest';
import { matchesPeopleFilters } from '../src/lib/people-filters';

const person = { status: 'active', emailVerified: false, accounts: [{ type: 'provider', status: 'pending' }, { type: 'facility', status: 'active' }] };
it('filters the selected account type and its own status together', () => {
  expect(matchesPeopleFilters(person, 'provider', 'pending', 'all')).toBe(true);
  expect(matchesPeopleFilters(person, 'provider', 'active', 'all')).toBe(false);
});
it('filters email verification without treating an active login as verified', () => {
  expect(matchesPeopleFilters(person, 'all', 'all', 'verified')).toBe(false);
  expect(matchesPeopleFilters(person, 'all', 'all', 'unverified')).toBe(true);
});