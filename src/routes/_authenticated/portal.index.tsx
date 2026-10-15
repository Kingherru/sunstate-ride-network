import { createFileRoute, Link } from "@tanstack/react-router";
import { getPortalSummary } from "@/lib/portal-requests.functions";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { ACCOUNT_TYPE_LABEL, RequestTable } from "@/components/portal/request-display";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { DsEmpty } from "@/components/ds/feedback";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Portal Overview — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => getPortalSummary(),
  component: PortalHome,
});

function PortalHome() {
  const s = Route.useLoaderData();
  const { access } = Route.useRouteContext();
  const ws = access.primary;
  const provider = access.portalKind === "provider";
  return (
    <>
      <PageHead title={ws?.name || "Your account"} action={!provider && <Link to="/portal/requests/new" className={actionCls}>New trip</Link>}>
        {ws ? <>{ACCOUNT_TYPE_LABEL[ws.type] ?? ws.type} account{ws.status === "pending" ? " · Pending review" : ""}</> : "MY FLORIDA NEMT account"}
      </PageHead>
      {provider && ws?.status === "pending" && (
        <p role="status" className="ds-body mb-5 rounded-ds bg-ds-warning-soft px-4 py-3">Your provider account is pending verification. Trips can be offered to you once verification is complete.</p>
      )}
      {provider ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className={`${panelCls} p-4 sm:p-5`} aria-labelledby="trips-h">
            <h2 id="trips-h" className="ds-subheading uppercase text-ds-primary">Trips &amp; schedule</h2>
            <p className="ds-body mt-2 text-ds-text-2">See trips offered or assigned to your company and your upcoming schedule.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/portal/trips" className={actionCls}>View trips</Link>
              <Link to="/portal/schedule" className="portal-btn-secondary">Schedule</Link>
            </div>
          </section>
          <section className={`${panelCls} p-4 sm:p-5`} aria-label="Notifications"><NotificationsPanel /></section>
        </div>
      ) : (
        <section className={panelCls} aria-labelledby="recent-h">
          <div className="flex items-center justify-between gap-3 border-b border-ds-border px-4 py-3 sm:px-5">
            <h2 id="recent-h" className="ds-subheading uppercase text-ds-primary">Recent requests</h2>
            {s.recent.length > 0 && <Link to="/portal/requests" className="ds-support font-semibold text-ds-link underline-offset-4 hover:underline">View all</Link>}
          </div>
          {s.recent.length === 0 ? (
            <DsEmpty title="No requests yet" action={<Link to="/portal/requests/new" className={actionCls}>New trip</Link>}>
              Requests you submit, or that your account is authorized to view, will appear here.
            </DsEmpty>
          ) : (
            <RequestTable rows={s.recent} detailBase="/portal/requests" />
          )}
        </section>
      )}
    </>
  );
}
