import type { NavItem } from "@/components/portal/PortalShell";

/** Single source of truth for portal navigation so real pages and the
 *  Master-Admin demo previews can never drift apart. */
export const PROVIDER_NAV: NavItem[] = [
  { to: "/portal", label: "Overview", exact: true },
  { to: "/portal/trips", label: "Trips" },
  { to: "/portal/schedule", label: "Schedule" },
  { to: "/portal/fleet", label: "Fleet & Drivers" },
  { to: "/portal/earnings", label: "Earnings & Payments" },
  { to: "/portal/network", label: "Network" },
  { to: "/portal/training", label: "Training & Tests" },
  { to: "/portal/messaging", label: "Messaging" },
];

export const RESTRICTED_PROVIDER_NAV: NavItem[] = [
  { to: "/portal", label: "Overview", exact: true },
  { to: "/portal/trips", label: "My trips" },
  { to: "/portal/training", label: "Training & Tests" },
];

export const CUSTOMER_NAV: NavItem[] = [
  { to: "/portal", label: "Overview", exact: true },
  { to: "/portal/requests/new", label: "New trip" },
  { to: "/portal/requests", label: "Trip history", exact: true },
  { to: "/portal/upload-csv", label: "Upload CSV" },
  { to: "/portal/saved-providers", label: "Saved providers" },
  { to: "/portal/find-providers", label: "Find providers" },
  { to: "/portal/contacts", label: "Contacts & payers" },
  { to: "/portal/notifications", label: "Notifications" },
  { to: "/portal/messaging", label: "Messaging" },
];

export const CUSTOMER_ONLY = [ "/portal/upload-csv", "/portal/find-providers", "/portal/saved-providers", "/portal/contacts", "/portal/payers"];
export const PROVIDER_ONLY = ["/portal/trips", "/portal/schedule", "/portal/vehicles", "/portal/drivers", "/portal/fleet", "/portal/earnings", "/portal/network"];
export const RESTRICTED_BLOCK = ["/portal/schedule", "/portal/vehicles", "/portal/drivers", "/portal/fleet", "/portal/earnings", "/portal/upload-csv"];
export const under = (p: string, list: string[]) => list.some((x) => p === x || p.startsWith(x + "/"));

type PortalNavigationAccess = {
  portalKind: 'provider' | 'customer';
  restricted: boolean;
  canMessageForWorkspace: boolean;
  canUploadCsvRequests: boolean;
};

/** Use identical page checks for sidebar visibility and direct navigation. */
export function isPortalPathBlocked(path: string, access: PortalNavigationAccess): boolean {
  const provider = access.portalKind === 'provider';
  if ((provider && under(path, CUSTOMER_ONLY)) || (!provider && under(path, PROVIDER_ONLY))) return true;
  if (under(path, ['/portal/upload-csv'])) return !access.canUploadCsvRequests;
  if (under(path, ['/portal/messaging'])) return !access.canMessageForWorkspace;
  return access.restricted && under(path, RESTRICTED_BLOCK);
}

export function portalNavigation(access: PortalNavigationAccess): NavItem[] {
  const nav = access.portalKind === 'provider'
    ? (access.restricted ? [...RESTRICTED_PROVIDER_NAV, { to: '/portal/messaging', label: 'Messaging' }] : PROVIDER_NAV)
    : CUSTOMER_NAV;
  return nav.filter((item) => !isPortalPathBlocked(item.to, access));
}

export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/people", label: "People & accounts" },
  { to: "/admin/requests", label: "Requests" },
  { to: "/admin/messaging", label: "Messaging" },
  { to: "/admin/pricing", label: "Pricing" },
  { to: "/admin/payouts", label: "Payouts" },
  { to: "/admin/integrations", label: "Integrations" },
  { to: "/admin/admins", label: "Administrators" },
  { to: "/admin/security", label: "Security" },
  { to: '/admin/training', label: 'Training', iconFor: '/portal/training' },
];
