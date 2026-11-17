import { noticeKind, noticeKey, planChannels, noticeTrip, type AssignmentEvent } from './driver-assignment-notice';

/** Runs only after assign_trip_resources succeeded for the caller. Failures never undo the assignment. */
export async function notifyDriverAssignment(tripId: string) {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: ev } = await supabaseAdmin.from('trip_dispatch_events').select('id,payload').eq('trip_id', tripId).eq('event_type', 'resources_assigned').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!ev) return;
    const p = (ev.payload ?? {}) as Record<string, string | null>;
    const event: AssignmentEvent = { id: ev.id, before_driver: p.before_driver ?? null, driver_id: p.driver_id ?? null };
    const kind = noticeKind(event);
    if (!kind) return;
    const key = noticeKey(event, 'email');
    const { data: prior } = await supabaseAdmin.from('trip_dispatch_events').select('id').eq('trip_id', tripId).eq('event_type', 'driver_assignment_notice').contains('payload', { key }).limit(1);
    if (prior?.length) return;
    const [{ data: driver }, { data: trip }, { data: flag }] = await Promise.all([
      supabaseAdmin.from('drivers').select('first_name,email,phone').eq('id', event.driver_id!).maybeSingle(),
      supabaseAdmin.from('trips').select('id,pickup_date,scheduled_start_time,pickup_time,pickup_address,dropoff_address').eq('id', tripId).maybeSingle(),
      supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key', 'driver_assignment_notifications').maybeSingle(),
    ]);
    if (!driver || !trip) return;
    const plan = planChannels({ flagOn: Boolean(flag?.enabled), preview: false, email: driver.email, phone: driver.phone, smsConfigured: false });
    let emailResult: string = plan.email;
    if (plan.email === 'queued') {
      const { sendTemplateEmail } = await import('@/lib/email-templates/send-email');
      const r = await sendTemplateEmail('driver-schedule', driver.email!, { templateData: { driverName: driver.first_name, periodLabel: kind === 'reassigned' ? 'Updated assignment' : 'New assignment', trips: [noticeTrip(trip)] }, idempotencyKey: key }).catch(() => ({ sent: false, reason: 'send_failed' }));
      emailResult = r.sent ? 'sent' : (r as { reason?: string }).reason ?? 'not_sent';
    }
    await supabaseAdmin.from('trip_dispatch_events').insert({ trip_id: tripId, event_type: 'driver_assignment_notice', vendor: 'mfn', payload: { key, kind, assignment_event: ev.id, driver_id: event.driver_id, email: emailResult, sms: plan.sms } });
  } catch { /* notice issues never affect the saved assignment */ }
}
