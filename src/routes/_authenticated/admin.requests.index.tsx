import { createFileRoute } from "@tanstack/react-router";
import { listAdminRequests } from "@/lib/portal-requests.functions";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { RequestTable } from "@/components/portal/request-display";
import { DsEmpty } from "@/components/ds/feedback";

export const Route = createFileRoute("/_authenticated/admin/requests/")({
  head: () => ({ meta: [{ title: "Admin Requests — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => listAdminRequests(),
  component: AdminRequests,
});

function AdminRequests() {
  const rows = Route.useLoaderData();
  return (
    <>
      <PageHead title="Requests">Addresses, contact details and instructions are shown only on each request's detail page.</PageHead>
      <section className={panelCls}>
        {rows.length === 0 ? <DsEmpty title="No requests yet" /> : <RequestTable rows={rows} detailBase="/admin/requests" showSource />}
      </section>
    </>
  );
}
