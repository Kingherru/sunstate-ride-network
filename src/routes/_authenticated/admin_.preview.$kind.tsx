import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { getAccessState } from "@/lib/access.functions";
import { PortalShell, actionCls, panelCls, type NavItem } from "@/components/portal/PortalShell";
import { PROVIDER_NAV, CUSTOMER_NAV } from "@/components/portal/portal-nav";
import { ORGANIZATION_TYPES, organizationLabel } from "@/lib/account-types";

type Kind = "provider" | "customer";

export const Route = createFileRoute("/_authenticated/admin_/preview/$kind")({
  head: () => ({ meta: [{ title: "Portal Preview — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
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

function demoAction() {
  toast("Preview only — no information was saved");
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
    ? { name: "Sunshine Coast Transport (Demo)", mfnId: "MFN-P-DEMO01", label: "PROVIDER" }
    : { name: `Demo ${organizationLabel(accountType)}`, mfnId: "MFN-R-DEMO01", label: organizationLabel(accountType).toUpperCase() };

  function setAccountType(v: string) {
    navigate({ search: (prev) => ({ ...prev, accountType: v }) });
  }

  const pageTitle = baseNav.find((n) => pageKeyOf(n.to) === activePage)?.label ?? "Overview";

  return (
    <PortalShell nav={nav} area={isProvider ? "Provider portal" : "Portal"} identity={identity} changelogTo="/portal/changelog" title={pageTitle}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-ds border-2 border-ds-accent bg-ds-accent/10 px-4 py-3">
        <p className="ds-body font-semibold uppercase tracking-[0.04em] text-ds-accent">Demo portal preview — synthetic data only</p>
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

      <DemoBody kind={kind as Kind} page={activePage} />
    </PortalShell>
  );
}

function DemoWriteButton({ children }: { children: React.ReactNode }) {
  return <button type="button" onClick={demoAction} className={actionCls}>{children}</button>;
}

function DemoTable({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <div className={`${panelCls} overflow-x-auto`}>
      <table className="w-full text-left">
        <thead><tr className="border-b border-ds-border">{cols.map((c) => <th key={c} className="ds-support px-4 py-3 uppercase tracking-[0.06em]">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-ds-border last:border-0">
              {r.map((v, j) => <td key={j} className="ds-body px-4 py-3">{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PROVIDER_PAGES: Record<string, { heading: string; body: React.ReactNode }> = {
  overview: { heading: "Overview", body: <DemoTable cols={["Metric", "Value"]} rows={[["Trips this week", "24"], ["Active drivers", "6"], ["Vehicles", "8"], ["Balance", "$1,240.00"]]} /> },
  trips: { heading: "Trips", body: <DemoTable cols={["Trip", "Rider", "Status", "Date"]} rows={[["TR-10231", "J. Sample", "Completed", "May 1"], ["TR-10244", "A. Example", "Scheduled", "May 3"]]} /> },
  schedule: { heading: "Schedule", body: <DemoTable cols={["Driver", "Vehicle", "Shift"]} rows={[["D. Driverly", "Van 02", "8a–4p"], ["S. Sample", "Van 05", "10a–6p"]]} /> },
  vehicles: { heading: "Vehicles", body: <DemoTable cols={["Vehicle", "Type", "Status"]} rows={[["Van 02", "Wheelchair", "Active"], ["Van 05", "Ambulatory", "Active"]]} /> },
  drivers: { heading: "Drivers", body: <DemoTable cols={["Driver", "Status", "Training"]} rows={[["D. Driverly", "Active", "Complete"], ["S. Sample", "Active", "In progress"]]} /> },
  training: { heading: "Training & Tests", body: <DemoTable cols={["Course", "Status"]} rows={[["Defensive Driving", "Complete"], ["HIPAA Basics", "In progress"]]} /> },
};

const CUSTOMER_PAGES: Record<string, { heading: string; body: React.ReactNode }> = {
  overview: { heading: "Overview", body: <DemoTable cols={["Metric", "Value"]} rows={[["Open requests", "2"], ["Completed trips", "18"], ["Saved providers", "3"]]} /> },
  "requests/new": { heading: "New trip", body: <p className="ds-body max-w-xl">A demo copy of the request form would appear here. Submitting is disabled in preview.</p> },
  requests: { heading: "Trip history", body: <DemoTable cols={["Request", "Status", "Date"]} rows={[["RQ-5581", "Completed", "Apr 29"], ["RQ-5602", "Scheduled", "May 2"]]} /> },
  "upload-csv": { heading: "Upload CSV", body: <p className="ds-body max-w-xl">A demo CSV upload panel would appear here. Uploading is disabled in preview.</p> },
  "find-providers": { heading: "Find providers", body: <DemoTable cols={["Provider", "Coverage", "Rating"]} rows={[["Sunshine Coast Transport", "Tampa Bay", "4.8"], ["Gulfside Rides", "Pinellas", "4.6"]]} /> },
  "saved-providers": { heading: "Saved providers", body: <DemoTable cols={["Provider", "Saved on"]} rows={[["Sunshine Coast Transport", "Apr 2"]]} /> },
  contacts: { heading: "Contacts", body: <DemoTable cols={["Name", "Role"]} rows={[["J. Sample", "Scheduler"]]} /> },
  payers: { heading: "Payers", body: <DemoTable cols={["Payer", "Type"]} rows={[["Demo Insurance Co.", "Insurance"]]} /> },
  notifications: { heading: "Notifications", body: <DemoTable cols={["Notification", "Date"]} rows={[["Trip RQ-5602 confirmed", "May 2"]]} /> },
};

function DemoBody({ kind, page }: { kind: Kind; page: string }) {
  const table = kind === "provider" ? PROVIDER_PAGES : CUSTOMER_PAGES;
  const entry = table[page] ?? table.overview;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ds-section-title uppercase text-ds-primary">{entry.heading}</h2>
        <DemoWriteButton>New</DemoWriteButton>
      </div>
      {entry.body}
    </div>
  );
}
