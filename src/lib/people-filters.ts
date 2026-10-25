export interface FilterPerson {
  status: string;
  emailVerified: boolean;
  accounts: { type: string; status: string }[];
}

/** Account status is distinct from the person's ability to sign in. */
export function matchesPeopleFilters(person: FilterPerson, type: string, accountStatus: string, verification: string) {
  const accounts = person.accounts.filter(account => type === 'all' || account.type === type);
  if (type !== 'all' && accounts.length === 0) return false;
  if (accountStatus !== 'all' && !accounts.some(account => account.status === accountStatus)) return false;
  return verification === 'all' || person.emailVerified === (verification === 'verified');
}