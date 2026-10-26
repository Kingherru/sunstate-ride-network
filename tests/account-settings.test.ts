import { describe, expect, test } from 'bun:test';
import { personalSettingsInput, approximateMiles, serviceCompatibility } from '../src/lib/account-settings-rules';
import { safeCsvCell, EXPORT_FIELDS } from '../src/lib/provider-export-rules';
describe('personal settings boundary', () => {
  const input = { firstName: 'Demo', lastName: 'Person', phone: '', preferences: { in_app: true, email: false } };
  test('names phone and notification preferences are editable', () => expect(personalSettingsInput.parse(input)).toEqual(input));
  test('role and account type cannot be changed through personal settings', () => {
    expect(personalSettingsInput.safeParse({ ...input, role: 'admin' }).success).toBe(false);
    expect(personalSettingsInput.safeParse({ ...input, account_type: 'provider' }).success).toBe(false);
  });
  test('security notices cannot be opted out through arbitrary preference keys', () => expect(personalSettingsInput.safeParse({ ...input, preferences: { ...input.preferences, security: false } }).success).toBe(false));
});
describe('private proximity', () => {
  test('straight-line miles are real and same point is zero', () => { expect(approximateMiles({ lat: 28, lng: -81 }, { lat: 29, lng: -81 })).toBeCloseTo(69.09, 1); expect(approximateMiles({ lat: 28, lng: -81 }, { lat: 28, lng: -81 })).toBe(0); });
  test('radius compatibility does not guess unknown centers', () => { expect(serviceCompatibility(20, 50, undefined, [])).toBe('Within service radius'); expect(serviceCompatibility(100, 50, undefined, [])).toBe('Outside service radius'); expect(serviceCompatibility(null, 50, undefined, [])).toBe('Not confirmed'); });
});
describe('safe dispatch exports', () => {
  test('CSV neutralizes spreadsheet formula injection', () => { expect(safeCsvCell('=1+1')).toBe('"\'=1+1"'); expect(safeCsvCell('A"B')).toBe('"A""B"'); });
  test('exports exclude patient medical and card fields', () => { expect(EXPORT_FIELDS.includes('pickup_date')).toBe(true); expect([...EXPORT_FIELDS]).not.toContain('diagnosis_code'); expect([...EXPORT_FIELDS]).not.toContain('card_number'); });
});