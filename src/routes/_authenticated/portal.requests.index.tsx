import { createFileRoute, Link } from "@tanstack/react-router";
import { listPortalRequests } from "@/lib/portal-requests.functions";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { RequestTable } from "@/components/portal/request-display";
import { DsEmpty } from "@/components/ds/feedback";

export const Route = createFileRoute("/_authenticated/portal/requests/")({
  head: () => ({ meta: [{ title: "Requests — MY FLORIDA NEMT Portal" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => listPortalRequests(),
  component: Requests,
});

function Requests() {
  const rows = Route.useLoaderData();
  return (
    <>
      <PageHead title="Requests" action={<Link to="/portal/requests/new" className={actionCls}>New request</Link>}>
        Only requests you're authorized to view are shown.
      </PageHead>
      <section className={panelCls}>
        {rows.length === 0 ? (
          <DsEmpty title="No requests yet" action={<Link to="/portal/requests/new" className={actionCls}>New request</Link>}>
            Submit a passenger transportation or medical delivery request to get started.
          </DsEmpty>
        ) : <RequestTable rows={rows} detailBase="/portal/requests" />}
      </section>
    </>
  );
}
