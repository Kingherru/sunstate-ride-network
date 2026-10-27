import { z } from 'zod';
export const EMAIL_REAUTH_SECONDS = 300;
export const emailChangeInput = z.object({ newEmail: z.string().trim().email().max(254), currentPassword: z.string().max(1024).optional() }).strict();
/** Only signed Auth AMR timestamps count. JWT refresh iat is not reauthentication. */
export function hasRecentAuthentication(amr: unknown, nowSeconds: number) {
  return Array.isArray(amr) && amr.some(a => a && typeof a === 'object' &&
    typeof a.timestamp === 'number' && ['password','oauth','totp','sso/saml'].includes(a.method) &&
    a.timestamp <= nowSeconds && nowSeconds - a.timestamp <= EMAIL_REAUTH_SECONDS);
}
export function emailConfirmationFailure(code: string | undefined) {
  return code === 'otp_expired' ? 'expired' : 'failed';
}