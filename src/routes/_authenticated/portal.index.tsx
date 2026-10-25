import { createFileRoute, Link } from "@tanstack/react-router";
import { getPortalSummary } from "@/lib/portal-requests.functions";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { ACCOUNT_TYPE_LABEL, RequestTable } from "@/components/portal/request-display";
import { ProviderOverview } from "@/components/portal/ProviderOverview";
import { DsEmpty } from "@/components/ds/feedback";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Portal Overview — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => getPortalSummary(),
  component: PortalHome,
});

function PortalHome() {
  const s = Route.useLoaderData();
  const { access, user } = Route.useRouteContext();
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
        <ProviderOverview workspaceId={ws?.status === "active" ? ws.id : null} userId={user.id} />
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
