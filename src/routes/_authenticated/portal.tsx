import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccessState, type AccessState } from "@/lib/access.functions";
import { PortalShell, type NavItem } from "@/components/portal/PortalShell";
import { ACCOUNT_TYPE_LABEL } from "@/components/portal/request-display";
import { organizationLabel } from "@/lib/account-types";

const PROVIDER_NAV: NavItem[] = [
  { to: "/portal", label: "Overview", exact: true },
  { to: "/portal/trips", label: "Trips" },
  { to: "/portal/schedule", label: "Schedule" },
  { to: "/portal/vehicles", label: "Vehicles" },
  { to: "/portal/drivers", label: "Drivers" },
  { to: "/portal/training", label: "Training & Tests" },
  { to: "/portal/account", label: "Account" },
];
const RESTRICTED_PROVIDER_NAV: NavItem[] = [
  { to: "/portal", label: "Overview", exact: true },
  { to: "/portal/trips", label: "My trips" },
  { to: "/portal/training", label: "Training & Tests" },
  { to: "/portal/account", label: "Account" },
];
const CUSTOMER_ONLY = ["/portal/requests", "/portal/upload-csv", "/portal/find-providers", "/portal/saved-providers", "/portal/contacts", "/portal/payers", "/portal/notifications"];
const PROVIDER_ONLY = ["/portal/trips", "/portal/schedule", "/portal/vehicles", "/portal/drivers"];
const RESTRICTED_BLOCK = ["/portal/schedule", "/portal/vehicles", "/portal/drivers", "/portal/upload-csv"];
const under = (p: string, list: string[]) => list.some((x) => p === x || p.startsWith(x + "/"));

const CUSTOMER_NAV: NavItem[] = [
  { to: "/portal", label: "Overview", exact: true },
  { to: "/portal/requests/new", label: "New trip" },
  { to: "/portal/requests", label: "Trip history", exact: true },
  { to: "/portal/upload-csv", label: "Upload CSV" },
  { to: "/portal/find-providers", label: "Find providers" },
  { to: "/portal/saved-providers", label: "Saved providers" },
  { to: "/portal/contacts", label: "Contacts" },
  { to: "/portal/payers", label: "Payers" },
  { to: "/portal/notifications", label: "Notifications" },
  { to: "/portal/account", label: "Account" },
];

function identityFor(a: AccessState) {
  const ws = a.primary;
  const kind = ws ? ACCOUNT_TYPE_LABEL[ws.type] ?? ws.type : a.isAdmin ? "MFN Admin" : "Account";
  const label = ws && ws.type !== "provider" ? `${kind} · ${organizationLabel(ws.organization_type)}` : kind;
  return { name: ws?.name || a.displayName || "Your account", mfnId: a.mfnId, label };
}

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Portal — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async ({ location }) => {
    // Server-verified: training-only learners go to Training, suspended/pending to their status page.
    const access = await getAccessState();
    // Only the Master Admin may preview portals without an account of their own.
    if (!access.isMasterAdmin && access.destination !== "/portal") throw redirect({ to: access.destination });
    const path = location.pathname;
    const provider = access.portalKind === "provider";
    if ((provider && under(path, CUSTOMER_ONLY)) || (!provider && under(path, PROVIDER_ONLY)) || (access.restricted && under(path, RESTRICTED_BLOCK))) {
      if (!access.isMasterAdmin) throw redirect({ to: "/portal" });
    }
    return { access };
  },
  component: PortalLayout,
});

function PortalLayout() {
  const { access } = Route.useRouteContext();
  const provider = access.portalKind === "provider";
  return (
    <PortalShell nav={provider ? (access.restricted ? RESTRICTED_PROVIDER_NAV : PROVIDER_NAV) : CUSTOMER_NAV} area={provider ? "Provider portal" : "Portal"} identity={identityFor(access)} changelogTo="/portal/changelog">
      <Outlet />
    </PortalShell>
  );
}
