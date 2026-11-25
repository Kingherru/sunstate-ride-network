import { describe, it, expect, vi, beforeEach } from 'vitest';
// Fake transport + in-memory event sink: no real database or email is touched.
const events: any[] = []; const sent: any[] = []; let sendMode: 'ok' | 'fail' = 'ok';
let driver: any; let flag = true;
function q(table: string) {
  const f: any = {}; let filters: Record<string, unknown> = {}; let contains: any = null;
  const chain = { select: () => chain, eq: (k: string, v: unknown) => { filters[k] = v; return chain; }, order: () => chain, contains: (_: string, v: any) => { contains = v; return chain; },
    limit: () => (table === 'trip_dispatch_events' && filters.event_type === 'driver_assignment_notice') ? Promise.resolve({ data: events.filter(e => e.event_type === 'driver_assignment_notice' && e.trip_id === filters.trip_id && e.payload.key === contains?.key) }) : chain,
    maybeSingle: () => Promise.resolve({ data: table === 'trip_dispatch_events' ? [...events].reverse().find(e => e.event_type === 'resources_assigned' && e.trip_id === filters.trip_id) ?? null
      : table === 'drivers' ? driver : table === 'trips' ? { id: 'trip-1-abcdef', pickup_date: '2026-11-25', scheduled_start_time: '14:00' } : table === 'platform_launch_flags' ? { enabled: flag } : { driver_assignment_email_enabled: true } }),
    insert: (row: any) => { events.push(row); return Promise.resolve({ error: null }); } };
  return Object.assign(f, chain);
}
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: (t: string) => q(t) } }));
vi.mock('@/lib/email-templates/send-email', () => ({ sendTemplateEmail: async (tpl: string, to: string, o: any) => { if (sendMode === 'fail') throw new Error('transport down'); sent.push({ tpl, to, key: o.idempotencyKey }); return { sent: true }; } }));
const { notifyDriverAssignment } = await import('../src/lib/driver-assignment-notify.server');
const assign = (id: string, before: string | null, after: string | null) => events.push({ id, trip_id: 'trip-1-abcdef', event_type: 'resources_assigned', payload: { before_driver: before, driver_id: after } });
const notices = () => events.filter(e => e.event_type === 'driver_assignment_notice');
beforeEach(() => { events.length = 0; sent.length = 0; sendMode = 'ok'; flag = true; driver = { first_name: 'Test', email: 'driver@example.test', phone: null, assignment_email_enabled: true, workspace_id: 'ws' }; });
describe('driver assignment notice (fake sink)', () => {
  it('sends once to the saved driver email after assignment and ignores retries', async () => {
    assign('ev1', null, 'd1'); await notifyDriverAssignment('trip-1-abcdef'); await notifyDriverAssignment('trip-1-abcdef');
    expect(sent).toEqual([{ tpl: 'driver-schedule', to: 'driver@example.test', key: 'driver-assignment-ev1-d1-email' }]);
    expect(notices()).toHaveLength(1); expect(notices()[0].payload.kind).toBe('assigned');
  });
  it('records a failed send without throwing', async () => {
    sendMode = 'fail'; assign('ev1', null, 'd1'); await expect(notifyDriverAssignment('trip-1-abcdef')).resolves.toBeUndefined();
    expect(sent).toHaveLength(0); expect(notices()[0].payload.email).toBe('send_failed');
  });
  it('notifies the new driver on reassignment', async () => {
    assign('ev2', 'd1', 'd2'); await notifyDriverAssignment('trip-1-abcdef');
    expect(sent[0].key).toBe('driver-assignment-ev2-d2-email'); expect(notices()[0].payload.kind).toBe('reassigned');
  });
  it('sends nothing when unscheduled, same driver, launch flag off or no saved email', async () => {
    assign('ev3', 'd1', null); await notifyDriverAssignment('trip-1-abcdef');
    assign('ev4', 'd1', 'd1'); await notifyDriverAssignment('trip-1-abcdef');
    flag = false; assign('ev5', null, 'd3'); await notifyDriverAssignment('trip-1-abcdef');
    flag = true; driver.email = ''; assign('ev6', null, 'd4'); await notifyDriverAssignment('trip-1-abcdef');
    expect(sent).toHaveLength(0); expect(notices().map(n => n.payload.email)).toEqual(['suppressed_flag_off', 'skipped_no_contact']);
  });
});
