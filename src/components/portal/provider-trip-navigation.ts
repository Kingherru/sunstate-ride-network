/** Presentation-level sections; underlying trip/draft statuses are unchanged. */
export const PROVIDER_RESERVATION_TABS = [
  {value: 'pending', label: 'Unconfirmed & Drafts'},
  {value: 'booked', label: 'Booked'},
  {value: 'past', label: 'Past'},
  {value: 'history', label: 'History'},
] as const;
export type ProviderReservationView = (typeof PROVIDER_RESERVATION_TABS)[number]['value'];
export const DEFAULT_PROVIDER_RESERVATION: ProviderReservationView = 'booked';
/** Legacy links (?section=drafts/unconfirmed/canceled) land on the merged sections. */
export function reservationSectionFor(legacy: string | null | undefined): ProviderReservationView {
  if (legacy === 'drafts' || legacy === 'unconfirmed' || legacy === 'pending') return 'pending';
  if (legacy === 'canceled' || legacy === 'history') return 'history';
  if (legacy === 'past') return 'past';
  return DEFAULT_PROVIDER_RESERVATION;
}
