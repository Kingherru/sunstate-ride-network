import { getAccessState } from "@/lib/access.functions";
import { getSignInPreference } from './sign-in-preference.functions';
import { signInTarget } from './sign-in-preference-rules';

type Navigate = (opts: { to: string; replace?: boolean }) => Promise<void>;

/**
 * Shared post-sign-in routing for email/password sign-ins.
 * The server (getAccessState) always decides the destination; a stored
 * return path is honored only when it does not conflict with access rules.
 */
export async function routeAfterSignIn(navigate: Navigate, redirectPath?: string | null) {
  const state = await getAccessState();
  const preference = await getSignInPreference().catch(() => ({ value: null }));
  const target = signInTarget(state, preference.value, redirectPath);
  // App-connection approval pages carry a query string; load them as a full URL.
  if (target.startsWith("/.lovable/oauth/consent")) { window.location.assign(target); return; }
  await navigate({ to: target as "/portal", replace: true });
}
