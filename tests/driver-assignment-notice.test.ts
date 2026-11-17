import { describe, it, expect } from 'vitest';
import { noticeKind, noticeKey, planChannels } from '../src/lib/driver-assignment-notice';
describe('driver assignment notices', () => {
  it('first assignment is "assigned"', () => expect(noticeKind({ id: 'e', before_driver: null, driver_id: 'd' })).toBe('assigned'));
  it('new driver is "reassigned"', () => expect(noticeKind({ id: 'e', before_driver: 'a', driver_id: 'b' })).toBe('reassigned'));
  it('same driver re-saved sends nothing', () => expect(noticeKind({ id: 'e', before_driver: 'a', driver_id: 'a' })).toBeNull());
  it('unassigning sends nothing', () => expect(noticeKind({ id: 'e', before_driver: 'a', driver_id: null })).toBeNull());
  it('key is stable per event and driver', () => expect(noticeKey({ id: 'e1', before_driver: null, driver_id: 'd' }, 'email')).toBe(noticeKey({ id: 'e1', before_driver: 'x', driver_id: 'd' }, 'email')));
  it('preview never sends', () => expect(planChannels({ flagOn: true, preview: true, email: 'a@b.c', phone: '1', smsConfigured: true })).toEqual({ email: 'skipped_preview', sms: 'skipped_preview' }));
  it('flag off suppresses email', () => expect(planChannels({ flagOn: false, preview: false, email: 'a@b.c', phone: null, smsConfigured: false }).email).toBe('suppressed_flag_off'));
  it('missing contact is skipped, SMS reports missing provider', () => expect(planChannels({ flagOn: true, preview: false, email: null, phone: '555', smsConfigured: false })).toEqual({ email: 'skipped_no_contact', sms: 'sms_provider_not_configured' }));
});
