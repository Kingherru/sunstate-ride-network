import { createFileRoute, Link } from "@tanstack/react-router";
import { listAdminRequests } from "@/lib/portal-requests.functions";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { RequestTable } from "@/components/portal/request-display";
import { DsEmpty } from "@/components/ds/feedback";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Overview — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: async ({ context }) => {
    const { canOpen } = await import("./admin");
    if (!canOpen("/admin/requests", (context as any).perms)) return null;
    return listAdminRequests();
  },
  component: Overview,
});

function Overview() {
  const rows = Route.useLoaderData();
  if (rows === null) return (
    <>
      <PageHead title="Admin">Your administrator account is active.</PageHead>
      <section className={panelCls}><DsEmpty title="No sections assigned yet">The Master Admin hasn't given you access to any admin sections or accounts. Ask them to assign your permissions.</DsEmpty></section>
    </>
  );
  const recent = rows.slice(0, 5);
  return (
    <>
      <PageHead title="Admin" action={<Link to="/admin/requests" className={actionCls}>All requests</Link>}>
        Read-only request review. Status changes, routing and provider assignment are not available yet.
      </PageHead>
      <section className={panelCls}>
        <h2 className="ds-subheading border-b border-ds-border px-4 py-3 uppercase text-ds-primary sm:px-5">Latest requests</h2>
        {recent.length === 0 ? <DsEmpty title="No requests yet" /> : <RequestTable rows={recent} detailBase="/admin/requests" showSource />}
      </section>
    </>
  );
}
