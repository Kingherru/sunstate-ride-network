import type { NavItem } from "@/components/portal/PortalShell";

/** Single source of truth for portal navigation so real pages and the
 *  Master-Admin demo previews can never drift apart. */
export const PROVIDER_NAV: NavItem[] = [
  { to: "/portal", label: "Overview", exact: true },
  { to: "/portal/trips", label: "Trips" },
  { to: "/portal/schedule", label: "Schedule" },
  { to: "/portal/vehicles", label: "Vehicles" },
  { to: "/portal/drivers", label: "Drivers" },
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
  { to: "/portal/find-providers", label: "Find providers" },
  { to: "/portal/saved-providers", label: "Saved providers" },
  { to: "/portal/contacts", label: "Contacts" },
  { to: "/portal/payers", label: "Payers" },
  { to: "/portal/notifications", label: "Notifications" },
  { to: "/portal/messaging", label: "Messaging" },
];

export const CUSTOMER_ONLY = ["/portal/requests", "/portal/upload-csv", "/portal/find-providers", "/portal/saved-providers", "/portal/contacts", "/portal/payers", "/portal/notifications"];
export const PROVIDER_ONLY = ["/portal/trips", "/portal/schedule", "/portal/vehicles", "/portal/drivers", "/portal/network"];
export const RESTRICTED_BLOCK = ["/portal/schedule", "/portal/vehicles", "/portal/drivers", "/portal/upload-csv"];
export const under = (p: string, list: string[]) => list.some((x) => p === x || p.startsWith(x + "/"));

export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/people", label: "People & accounts" },
  { to: "/admin/requests", label: "Requests" },
  { to: "/admin/network", label: "Network activity", iconFor: '/portal/network' },
  { to: "/admin/on-behalf", label: "Request for a patient" },
  { to: "/admin/messaging", label: "Messaging" },
  { to: "/admin/pricing", label: "Pricing" },
  { to: "/admin/payouts", label: "Payouts" },
  { to: "/admin/integrations", label: "Integrations" },
  { to: "/admin/notifications", label: "Notifications" },
  { to: "/admin/admins", label: "Administrators" },
  { to: "/admin/security", label: "Security" },
];
