import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { getAccessState } from "@/lib/access.functions";
import { PortalShell, PageHead, actionCls, panelCls, type NavItem } from "@/components/portal/PortalShell";
import { PortalPreviewContext } from "@/components/portal/preview-data";
import { DsEmpty } from "@/components/ds/feedback";
import { ProviderOverview } from "@/components/portal/ProviderOverview";
import { ProviderTrips } from "@/components/portal/ProviderTrips";
import { TrainingTests } from "@/components/portal/TrainingTests";
import { ScheduleCalendarPanel } from "@/components/dashboard/ScheduleCalendarPanel";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { DriverEarningsPanel } from "@/components/dashboard/DriverEarningsPanel";
import { ContactsPanel } from "@/components/dashboard/ContactsPanel";
import { PayersPanel } from "@/components/dashboard/PayersPanel";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { ProviderDirectory } from "@/components/network/ProviderDirectory";
import { RequestForm } from "@/components/requests/RequestForm";
import { PROVIDER_NAV, CUSTOMER_NAV } from "@/components/portal/portal-nav";
import { ORGANIZATION_TYPES, organizationLabel } from "@/lib/account-types";
import { SampleConversations } from "@/components/messaging/SampleConversations";

type Kind = "provider" | "customer";

export const Route = createFileRoute("/_authenticated/admin_/preview/$kind")({
  head: () => ({ meta: [{ title: "Portal Preview — MY FLORIDA NEMT" }, { name: "description", content: "Protected demonstration of MY FLORIDA NEMT provider and patient portals." }, { property: "og:title", content: "Portal Preview — MY FLORIDA NEMT" }, { property: "og:description", content: "Protected provider and patient portal demonstration." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async ({ params }) => {
    if (params.kind !== "provider" && params.kind !== "customer") throw redirect({ to: "/admin/settings" });
    const access = await getAccessState();
    if (!access.isMasterAdmin) throw redirect({ to: "/admin/settings" });
  },
  validateSearch: (s: Record<string, unknown>): { page?: string; accountType?: string } => ({
    page: typeof s.page === "string" ? s.page : undefined,
    accountType: typeof s.accountType === "string" ? s.accountType : undefined,
  }),
  component: PortalPreview,
});

function pageKeyOf(to: string) {
  return to === "/portal" || to === "/admin" ? "overview" : to.replace(/^\/(portal|admin)\//, "");
}

function PortalPreview() {
  const { kind } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const isProvider = kind === "provider";
  const baseNav = isProvider ? PROVIDER_NAV : CUSTOMER_NAV;
  const previewTo = `/admin/preview/${kind}`;
  const accountType = search.accountType ?? "general_facility";
  const activePage = search.page ?? "overview";

  const nav: NavItem[] = useMemo(
    () => baseNav.map((n) => ({ to: previewTo, label: n.label, iconFor: n.to, search: { page: pageKeyOf(n.to) } })),
    [baseNav, previewTo],
  );

  const identity = isProvider
    ? { name: "Sunshine Coast Transport (Demo)", mfnId: "MFN-P-DEMO01", label: "" }
    : { name: `Demo ${organizationLabel(accountType)}`, mfnId: "MFN-R-DEMO01", label: "" };

  function setAccountType(v: string) {
    navigate({ search: (prev) => ({ ...prev, accountType: v }) });
  }

  const pageTitle = baseNav.find((n) => pageKeyOf(n.to) === activePage)?.label ?? "Overview";

  return (
    <PortalPreviewContext.Provider value={{ active: true, kind: kind as Kind, accountType }}>
    <PortalShell nav={nav} area={isProvider ? "Provider portal" : "Patient portal"} identity={identity} changelogTo="/portal/changelog" title={pageTitle}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-ds border-2 border-ds-accent bg-ds-accent/10 px-4 py-3">
        <p className="ds-body font-semibold uppercase tracking-[0.04em] text-ds-accent">Preview mode — demo information only, nothing is saved</p>
        <Link to="/admin/settings" className={actionCls}>Exit preview</Link>
      </div>

      {!isProvider && (
        <div className="mb-6 max-w-xs">
          <label htmlFor="acct-type" className="portal-label">Preview account type</label>
          <select id="acct-type" className="portal-input" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
            {ORGANIZATION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      <DemoBody kind={kind as Kind} page={activePage} accountType={accountType} />
    </PortalShell>
    </PortalPreviewContext.Provider>
  );
}

const PREVIEW_USER = "00000000-0000-0000-0000-000000000000";

function Panel({ children }: { children: React.ReactNode }) {
  return <div className={`${panelCls} p-4 sm:p-6`}>{children}</div>;
}

function Unavailable({ what }: { what: string }) {
  return <Panel><DsEmpty title={`${what} isn't shown in preview`}>This page reads live records that belong to real accounts, so the preview leaves it empty.</DsEmpty></Panel>;
}

/** Real portal components, fed by preview fixtures (usePortalQuery) and with
 *  every write blocked (usePortalMutation). No real account is impersonated. */
function realPage(kind: Kind, page: string): React.ReactNode {
  if (kind === "provider") {
    switch (page) {
      case "trips": return <Panel><ProviderTrips userId={PREVIEW_USER} /></Panel>;
      case "schedule": return <Panel><ScheduleCalendarPanel /></Panel>;
      case "vehicles": return <Panel><FleetPanel only="vehicles" /></Panel>;
      case "drivers": return <Panel><div className="space-y-8"><FleetPanel only="drivers" /><DriverEarningsPanel /></div></Panel>;
      case "network": return <Panel><ProviderDirectory /></Panel>;
      case "training": return <TrainingTests />;
      case "messaging": return <SampleConversations initiallyOpen />;
      default: return <ProviderOverview workspaceId="preview-ws" userId={PREVIEW_USER} />;
    }
  }
  switch (page) {
    case "requests/new": return <RequestForm context="portal" />;
    case "requests": return <Panel><DsEmpty title="No requests yet">Requests this account submits appear here.</DsEmpty></Panel>;
    case "upload-csv": return <Unavailable what="CSV upload" />;
    case "find-providers": return <Panel><ProviderDirectory /></Panel>;
    case "saved-providers": return <Panel><ProviderDirectory savedOnly /></Panel>;
    case "contacts": return <Panel><ContactsPanel /></Panel>;
    case "payers": return <Panel><PayersPanel /></Panel>;
    case "notifications": return <Panel><NotificationsPanel /></Panel>;
    case "messaging": return <SampleConversations initiallyOpen />;
    default: return <Panel><DsEmpty title="No requests yet">Recent requests for this account appear here.</DsEmpty></Panel>;
  }
}

function DemoBody({ kind, page, accountType }: { kind: Kind; page: string; accountType: string }) {
  const label = (kind === "provider" ? PROVIDER_NAV : CUSTOMER_NAV).find((n) => pageKeyOf(n.to) === page)?.label ?? "Overview";
  return (
    <PortalPreviewContext.Provider value={{ active: true, kind, accountType }}>
      <PageHead title={label} />
      {realPage(kind, page)}
    </PortalPreviewContext.Provider>
  );
}
