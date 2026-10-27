import { expect, test } from 'bun:test';
import { hasRecentAuthentication, emailChangeInput, emailConfirmationFailure } from '../src/lib/email-change-rules';
test('email requests require authentication within five minutes, not a refreshed JWT', () => {
  expect(hasRecentAuthentication([{ method: 'oauth', timestamp: 700 }], 1000)).toBe(true);
  expect(hasRecentAuthentication([{ method: 'oauth', timestamp: 699 }], 1000)).toBe(false);
  expect(hasRecentAuthentication([{ method: 'oauth', timestamp: 1001 }], 1000)).toBe(false);
  expect(hasRecentAuthentication(undefined, 1000)).toBe(false);
  expect(hasRecentAuthentication([{ method: 'token_refresh', timestamp: 1000 }], 1000)).toBe(false);
});
test('email input cannot override user identity, roles, purchases or ownership', () => {
  const input = { newEmail: 'new@example.invalid', currentPassword: 'not-a-real-password' };
  expect(emailChangeInput.safeParse(input).success).toBe(true);
  for (const key of ['userId','role','account_type','workspaceId','mfn_id','purchases']) expect(emailChangeInput.safeParse({ ...input, [key]: 'override' }).success).toBe(false);
});
test('only an authoritative expired-code result records expired, not a local timer', () => {
  expect(emailConfirmationFailure('otp_expired')).toBe('expired');
  expect(emailConfirmationFailure('invalid_token')).toBe('failed');
});