import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccessState, type AccessState } from "@/lib/access.functions";
import { PortalShell } from "@/components/portal/PortalShell";
import { ACCOUNT_TYPE_LABEL } from "@/components/portal/request-display";
import { organizationLabel } from "@/lib/account-types";
import { PROVIDER_NAV, RESTRICTED_PROVIDER_NAV, CUSTOMER_NAV, CUSTOMER_ONLY, PROVIDER_ONLY, RESTRICTED_BLOCK, under } from "@/components/portal/portal-nav";

export { PROVIDER_NAV, RESTRICTED_PROVIDER_NAV, CUSTOMER_NAV };

function identityFor(a: AccessState) {
  const ws = a.primary;
  if (a.isMasterAdmin) return { name: "", mfnId: a.mfnId, label: "MASTER ADMIN" };
  if (!ws) return { name: "", mfnId: a.mfnId, label: "" };
  const kind = ACCOUNT_TYPE_LABEL[ws.type] ?? ws.type;
  const label = ws.type === "provider" ? (ws.is_contractor ? "Contractor" : "Provider")
    : ws.type === "private_pay" ? "Private Pay"
    : organizationLabel(ws.organization_type) || kind;
  return { name: ws.name || a.displayName || "Your account", mfnId: a.mfnId, label: label.toUpperCase() };
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
    const restrictedWithoutMessaging = access.restricted && !access.canMessageForWorkspace && under(path, ["/portal/messaging"]);
    if ((provider && under(path, CUSTOMER_ONLY)) || (!provider && under(path, PROVIDER_ONLY)) || (access.restricted && under(path, RESTRICTED_BLOCK)) || restrictedWithoutMessaging) {
      if (!access.isMasterAdmin) throw redirect({ to: "/portal" });
    }
    return { access };
  },
  component: PortalLayout,
});

function PortalLayout() {
  const { access } = Route.useRouteContext();
  const provider = access.portalKind === "provider";
  const restrictedNav = access.canMessageForWorkspace
    ? [...RESTRICTED_PROVIDER_NAV, { to: "/portal/messaging", label: "Messaging" }]
    : RESTRICTED_PROVIDER_NAV;
  const nav = provider ? (access.restricted ? restrictedNav : PROVIDER_NAV) : CUSTOMER_NAV;
  return (
    <PortalShell nav={nav} area={provider ? "Provider portal" : "Patient portal"} identity={identityFor(access)} changelogTo="/portal/changelog"
      settingsTo="/portal/account" notificationsTo={!provider ? "/portal/notifications" : undefined}>
      <Outlet />
    </PortalShell>
  );
}
