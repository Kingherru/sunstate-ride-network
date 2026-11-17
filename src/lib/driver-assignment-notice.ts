/** Pure rules for driver assignment notices. No delivery happens here. */
export type AssignmentEvent = { id: string; before_driver: string | null; driver_id: string | null };
export type NoticeKind = 'assigned' | 'reassigned';
export type ChannelState = 'queued' | 'skipped_no_contact' | 'suppressed_flag_off' | 'sms_provider_not_configured' | 'skipped_preview' | 'suppressed_provider_off' | 'suppressed_driver_off';

/** Only a new driver gets a notice; unassigning or re-saving the same driver never repeats one. */
export function noticeKind(e: AssignmentEvent): NoticeKind | null {
  if (!e.driver_id || e.before_driver === e.driver_id) return null;
  return e.before_driver ? 'reassigned' : 'assigned';
}

/** One key per assignment event and driver, so retries never duplicate a notice. */
export function noticeKey(e: AssignmentEvent, channel: 'email' | 'sms') {
  return `driver-assignment-${e.id}-${e.driver_id}-${channel}`;
}

export function planChannels(o: { flagOn: boolean; preview: boolean; providerOn?: boolean; driverOn?: boolean; email: string | null; phone: string | null; smsConfigured: boolean }): { email: ChannelState; sms: ChannelState } {
  if (o.preview) return { email: 'skipped_preview', sms: 'skipped_preview' };
  return {
    email: !o.providerOn ? 'suppressed_provider_off' : !o.driverOn ? 'suppressed_driver_off' : !validEmail(o.email) ? 'skipped_no_contact' : o.flagOn ? 'queued' : 'suppressed_flag_off',
    sms: !o.phone ? 'skipped_no_contact' : !o.smsConfigured ? 'sms_provider_not_configured' : o.flagOn ? 'queued' : 'suppressed_flag_off',
  };
}

/** Minimum schedule fields approved for driver trip logs. */
export function noticeTrip(t: { pickup_date?: string | null; scheduled_start_time?: string | null; pickup_time?: string | null; id: string; pickup_address?: string | null; dropoff_address?: string | null }) {
  return { date: t.pickup_date ?? undefined, time: (t.scheduled_start_time ?? t.pickup_time ?? '').slice(0, 5) || null, reference: t.id.slice(0, 8).toUpperCase(), pickup: t.pickup_address ?? undefined, destination: t.dropoff_address ?? undefined };
}

export function validEmail(v: string | null | undefined) { return !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

/** Plain status shown on a driver record; never claims a delivery happened. */
export function driverEmailState(o: { providerOn: boolean; driverOn: boolean; email: string | null | undefined }): 'Off' | 'No email' | 'Ready' {
  if (!o.providerOn || !o.driverOn) return 'Off';
  return validEmail(o.email) ? 'Ready' : 'No email';
}
