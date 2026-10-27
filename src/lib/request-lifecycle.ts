/** Request lifecycle rules. Mirrors public.request_lifecycle_allowed in the database,
 *  which is the authority; this copy drives which buttons are shown. */
export const LIFECYCLE_STATES = [
  'submitted', 'in_review', 'distributed', 'provider_viewed', 'accepted',
  'declined', 'completed', 'cancelled', 'no_provider_available',
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  submitted: 'Submitted', in_review: 'In Review', distributed: 'Distributed',
  provider_viewed: 'Provider Viewed', accepted: 'Accepted', declined: 'Declined',
  completed: 'Completed', cancelled: 'Cancelled', no_provider_available: 'No Provider Available',
};

const NEXT: Record<LifecycleState, LifecycleState[]> = {
  submitted: ['in_review', 'cancelled'],
  in_review: ['distributed', 'accepted', 'declined', 'cancelled', 'no_provider_available'],
  distributed: ['provider_viewed', 'accepted', 'no_provider_available', 'cancelled', 'distributed'],
  provider_viewed: ['accepted', 'no_provider_available', 'cancelled', 'distributed'],
  no_provider_available: ['distributed', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  declined: [], completed: [], cancelled: [],
};

export function canTransition(from: LifecycleState, to: LifecycleState) {
  return NEXT[from]?.includes(to) ?? false;
}

/** Transitions an admin may choose manually (Provider Viewed is provider-only). */
export function adminNextStates(from: LifecycleState): LifecycleState[] {
  return (NEXT[from] ?? []).filter((s) => s !== 'provider_viewed');
}

export function isLifecycleState(v: unknown): v is LifecycleState {
  return typeof v === 'string' && (LIFECYCLE_STATES as readonly string[]).includes(v);
}

/** Automatic distribution only runs when the server launch flag is on. */
export const AUTO_DISTRIBUTION_FLAG = 'automatic_distribution';
export const NO_PROVIDER_TIMEOUT_HOURS = 24;
export function noProviderDue(distributedAt: Date, now: Date) {
  return now.getTime() - distributedAt.getTime() >= NO_PROVIDER_TIMEOUT_HOURS * 3600_000;
}
