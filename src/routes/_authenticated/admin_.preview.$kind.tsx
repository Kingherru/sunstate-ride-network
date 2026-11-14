import { WorkspaceMessaging } from "@/components/messaging/WorkspaceMessaging";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo,useState } from "react";
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
import { FleetDrivers } from "@/components/portal/FleetDrivers";
import { EarningsPayments } from "@/components/portal/EarningsPayments";
import { SampleConversations } from "@/components/messaging/SampleConversations";
import { ProviderNetworkPage } from '@/components/portal/ProviderNetworkPage';
import { ProviderSettings } from '@/components/portal/ProviderSettings';
import { AccountConnections } from '@/components/portal/AccountConnections';
import { PersonalSecurity } from '@/components/portal/PersonalSecurity';
import { OnboardingDemo } from '@/components/onboarding/OnboardingDemo';
import { DsButton } from '@/components/ds/controls';
import {PatientTrips} from '@/components/portal/PatientTrips';
import {NewTripWorkspace} from '@/components/portal/NewTripWorkspace';
import {ContactsPayersPanel} from '@/components/dashboard/ContactsPayersPanel';
function PreviewPeople(){const [tab,setTab]=useState<'patients'|'contacts'|'payers'|'connections'>('contacts');return <Panel><ContactsPayersPanel tab={tab} onTab={setTab}/></Panel>;}

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
    ? { name: "Sunshine Coast Transport (Demo)", mfnId: "MFN-P-DEMO01", label: "Provider" }
    : { name: `Demo ${organizationLabel(accountType)}`, mfnId: "MFN-R-DEMO01", label: organizationLabel(accountType) };

  function setAccountType(v: string) {
    navigate({ search: (prev) => ({ ...prev, accountType: v }) });
  }

  const pageTitle = activePage === 'account' ? 'Settings' : activePage === "requests/new" ? "New trip" : baseNav.find((n) => pageKeyOf(n.to) === activePage)?.label ?? "Overview";

  return (
    <PortalPreviewContext.Provider value={{ active: true, kind: kind as Kind, accountType }}>
    <PortalShell nav={nav} area={isProvider ? "Provider portal" : "Patient portal"} identity={identity} changelogTo="/portal/changelog" title={pageTitle} settingsTo={`${previewTo}?page=account`} notificationsTo={`${previewTo}?page=notifications`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 ds-glass px-4 py-3">
        <p className="ds-body font-semibold uppercase tracking-[0.04em] text-ds-accent">Preview mode — demo information only, nothing is saved</p>
        <Link to="/admin/settings" className={actionCls}>Exit preview</Link>
        <DsButton variant="ghost" onClick={() => navigate({ search: prev => ({ ...prev, page: 'onboarding' }) })}>Preview account setup</DsButton>
        {isProvider&&<DsButton variant="ghost" onClick={()=>navigate({search:prev=>({...prev,page:'contractor-intake'})})}>Preview contractor intake</DsButton>}
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
function realPage(kind: Kind, page: string, accountType: string): React.ReactNode {
  if (kind === "provider") {
    switch (page) {
      case "trips": return <Panel><ProviderTrips userId={PREVIEW_USER} /></Panel>;
      case 'contractor-intake':return <OnboardingDemo provider personal={false} contractor/>;
      case "schedule": return <Panel><ScheduleCalendarPanel /></Panel>;
      case "fleet": return <FleetDrivers />;
      case "earnings": return <EarningsPayments userId={PREVIEW_USER} />;
      case "requests/new": return <NewTripWorkspace workspaceId="preview-ws" provider/>;
      case "notifications": return <Panel><NotificationsPanel /></Panel>;
      case "account": return <Panel><ProviderSettings workspaceId="preview-ws" role="owner" email="demo@example.com" /></Panel>;
      case "vehicles": return <Panel><FleetPanel only="vehicles" /></Panel>;
      case "drivers": return <Panel><div className="space-y-8"><FleetPanel only="drivers" /><DriverEarningsPanel /></div></Panel>;
      case "network": return <ProviderNetworkPage />;
      case 'contacts':return <PreviewPeople/>;
      case "training": return <TrainingTests />;
      case "messaging": return <Panel><WorkspaceMessaging mode="portal" /></Panel>;
      default: return <ProviderOverview workspaceId="preview-ws" userId={PREVIEW_USER} />;
    }
  }
  switch (page) {
    case "requests/new": return accountType === 'private_pay_patient' ? <RequestForm context="portal" allowProviderSelection /> : <NewTripWorkspace workspaceId="preview-ws" provider={false}/>;
    case "account": return <Panel><div className="space-y-5"><PersonalSecurity email="demo@example.com" /><AccountConnections workspaceId="preview-ws" /></div></Panel>;
    case "requests": return <Panel><PatientTrips/></Panel>;
    case "upload-csv": return <Unavailable what="CSV upload" />;
    case "find-providers": return <Panel><ProviderDirectory /></Panel>;
    case "saved-providers": return <Panel><ProviderDirectory savedOnly /></Panel>;
    case "contacts": return <PreviewPeople/>;
    case "payers": return <Panel><PayersPanel /></Panel>;
    case "notifications": return <Panel><NotificationsPanel /></Panel>;
    case "messaging": return <SampleConversations initiallyOpen />;
    default: return <Panel><PatientTrips overview/></Panel>;
  }
}

function DemoBody({ kind, page, accountType }: { kind: Kind; page: string; accountType: string }) {
  const label = page === 'account' ? 'Settings' : page === "requests/new" ? "New trip" : (kind === "provider" ? PROVIDER_NAV : CUSTOMER_NAV).find((n) => pageKeyOf(n.to) === page)?.label ?? "Overview";
  return (
    <PortalPreviewContext.Provider value={{ active: true, kind, accountType }}>
      {!(kind === 'provider' && page === 'network') && <PageHead title={label} />}
      {page === 'onboarding' ? <OnboardingDemo provider={kind === 'provider'} personal={accountType === 'private_pay_patient'} /> : realPage(kind, page, accountType)}
    </PortalPreviewContext.Provider>
  );
}
