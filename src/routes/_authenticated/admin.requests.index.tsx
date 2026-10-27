import { createFileRoute } from "@tanstack/react-router";
import { listAdminRequests } from "@/lib/portal-requests.functions";
import { listOnBehalfCandidates } from "@/lib/admin-on-behalf.functions";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { RequestTable } from "@/components/portal/request-display";
import { DsEmpty } from "@/components/ds/feedback";
import { SegTabs } from "@/components/portal/SegTabs";
import { OnBehalfRequest } from "@/components/admin/OnBehalfRequest";
import { useAdminLevel } from "@/lib/use-admin-level";

type Tab = "all" | "new";
export const Route = createFileRoute("/_authenticated/admin/requests/")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: s.tab === "new" ? "new" : undefined }),
  head: () => ({ meta: [{ title: "Admin Requests — MY FLORIDA NEMT" }, { name: "description", content: "Review requests and submit one for a customer account." }, { property: "og:title", content: "Admin Requests — MY FLORIDA NEMT" }, { property: "og:description", content: "Protected admin requests." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: async () => {
    const [rows, candidates] = await Promise.all([listAdminRequests(), listOnBehalfCandidates().catch(() => [])]);
    return { rows, candidates };
  },
  component: AdminRequests,
});

function AdminRequests() {
  const { rows, candidates } = Route.useLoaderData();
  const { tab = "all" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const canCreate = useAdminLevel("requests") === "manage";
  return (
    <>
      {canCreate && <div className="mb-5"><SegTabs label="Request sections" value={tab} onChange={(t) => navigate({ search: { tab: t === "new" ? "new" : undefined } })} options={[{ value: "all", label: "All requests" }, { value: "new", label: "New for a customer" }]} /></div>}
      {tab === "new" && canCreate ? <OnBehalfRequest rows={candidates} /> : (
        <>
          <PageHead title="Requests">Select any request to open its details.</PageHead>
          <section className={panelCls}>
            {rows.length === 0 ? <DsEmpty title="No requests yet" /> : <RequestTable rows={rows} detailBase="/admin/requests" showSource />}
          </section>
        </>
      )}
    </>
  );
}
