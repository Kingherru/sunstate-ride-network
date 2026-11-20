export const PROVIDER_RESERVATION_TABS = [
  {value: 'unconfirmed', label: 'Unconfirmed'},
  {value: 'drafts', label: 'Drafts'},
  {value: 'booked', label: 'Booked'},
  {value: 'past', label: 'Past'},
  {value: 'canceled', label: 'Canceled'},
  {value: 'history', label: 'History'},
] as const;
export type ProviderReservationView = (typeof PROVIDER_RESERVATION_TABS)[number]['value'];
export const DEFAULT_PROVIDER_RESERVATION: ProviderReservationView = 'booked';