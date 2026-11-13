import type { AccessState } from './access.functions';
import { canOpen, type AdminPerms } from './admin-permissions';
import { ADMIN_NAV, portalNavigation } from '@/components/portal/portal-nav';

export function signInPageOptions(access: AccessState, perms?: AdminPerms) {
  if (access.profileSuspended || ['/account-status', '/account-setup'].includes(access.destination)) return [];
  if (access.isAdmin) return perms ? [...ADMIN_NAV, { to: '/admin/notifications', label: 'Notifications' }, { to: '/admin/settings', label: 'Settings' }].filter(p => p.to === '/admin/settings' || canOpen(p.to, perms)) : [];
  if (access.destination === '/learn') return [{ to: '/learn', label: 'Training' }, { to: '/learn/settings', label: 'Settings' }];
  return [...portalNavigation(access), { to: '/portal/account', label: 'Settings' }];
}

export function validatedSignInPage(saved: unknown, options: { to: string }[]): string | null {
  return typeof saved === 'string' && options.some(p => p.to === saved) ? saved : null;
}

/** Return-to wins over preferences; recovery/setup wins over either. */
export function signInTarget(access: AccessState, preferred: string | null, returnTo?: string | null) {
  if (access.destination === '/account-status' || access.destination === '/account-setup') return access.destination;
  if (typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\') && !/[\u0000-\u001f]/.test(returnTo) && !/^\/(login|auth|create-account|reset-password|forgot-password)(?:[/?#]|$)/.test(returnTo) && (access.isAdmin || !returnTo.startsWith('/admin'))) return returnTo;
  if (access.destination === '/portal' && access.onboardingPending) return '/onboarding';
  return preferred ?? access.destination;
}