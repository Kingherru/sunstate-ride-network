import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), preference: vi.fn() }));
vi.mock('../src/lib/access.functions', () => ({ getAccessState: mocks.access }));
vi.mock('../src/lib/sign-in-preference.functions', () => ({ getSignInPreference: mocks.preference }));
import { routeAfterSignIn } from '../src/lib/sign-in-routing';
beforeEach(() => {
  mocks.access.mockResolvedValue({ destination: '/portal', isAdmin: false, onboardingPending: false });
  mocks.preference.mockResolvedValue({ value: '/portal/account' });
});
describe('successful sign-in routing', () => {
  it('uses the server-validated personal destination', async () => { const navigate = vi.fn().mockResolvedValue(undefined); await routeAfterSignIn(navigate); expect(navigate).toHaveBeenCalledWith({ to: '/portal/account', replace: true }); });
  it('preserves a protected return-to instead of the personal preference', async () => { const navigate = vi.fn().mockResolvedValue(undefined); await routeAfterSignIn(navigate, '/portal/requests?view=drafts'); expect(navigate).toHaveBeenCalledWith({ to: '/portal/requests?view=drafts', replace: true }); });
  it('fails safely to Default when preference lookup is unavailable', async () => { mocks.preference.mockRejectedValue(new Error('Unavailable')); const navigate = vi.fn().mockResolvedValue(undefined); await routeAfterSignIn(navigate); expect(navigate).toHaveBeenCalledWith({ to: '/portal', replace: true }); });
});