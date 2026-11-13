import { describe, expect, it } from 'vitest';
import type { AccessState } from '../src/lib/access.functions';
import { signInPageOptions, signInTarget, validatedSignInPage } from '../src/lib/sign-in-preference-rules';

const patient: AccessState = { isAdmin: false, isMasterAdmin: false, profileSuspended: false, restricted: false, mfnId: null, displayName: null, workspaces: [], primary: null, portalKind: 'customer', canMessageForWorkspace: false, canUploadCsvRequests: false, setupIssue: null, destination: '/portal' };
describe('personal sign-in destination boundaries', () => {
  it('Default opens the existing role overview', () => { expect(signInTarget(patient, null)).toBe('/portal'); expect(signInTarget({ ...patient, isAdmin: true, destination: '/admin' }, null)).toBe('/admin'); });
  it('only authorized pages are offered, never from an admin title alone', () => { const paths = signInPageOptions({ ...patient, isAdmin: true, destination: '/admin' }, { master: false, sections: { messaging: 'read' }, scope: 'none' }).map(p => p.to); expect(paths).toContain('/admin/messaging'); expect(paths).not.toContain('/admin/payouts'); expect(paths).not.toContain('/admin/people'); });
  it('removed permissions fall back to Default', () => { expect(validatedSignInPage('/portal/messaging', signInPageOptions(patient))).toBeNull(); expect(validatedSignInPage('/removed', signInPageOptions(patient))).toBeNull(); });
  it('a legitimate return-to takes precedence and preserves its query', () => { expect(signInTarget(patient, '/portal/account', '/portal/requests?view=drafts')).toBe('/portal/requests?view=drafts'); });
  it('never loops to sign-in or accepts external return-to', () => { for (const path of ['/login?redirect=/portal', '//outside.example', '/auth', '/create-account', '/\\outside.example']) expect(signInTarget(patient, '/portal/account', path)).toBe('/portal/account'); });
  it('account recovery overrides preferences and return-to', () => { expect(signInTarget({ ...patient, destination: '/account-status', profileSuspended: true }, '/portal/account', '/portal/requests')).toBe('/account-status'); });
  it('provider options exclude customer-only pages and restricted tools', () => { const paths = signInPageOptions({ ...patient, portalKind: 'provider', restricted: true }).map(p => p.to); expect(paths).toContain('/portal/trips'); expect(paths).not.toContain('/portal/find-providers'); expect(paths).not.toContain('/portal/fleet'); });
  it('training-only users retain their own destinations', () => { expect(signInPageOptions({ ...patient, destination: '/learn' }).map(p => p.to)).toEqual(['/learn', '/learn/settings']); });
});