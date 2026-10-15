import { createFileRoute, Link } from "@tanstack/react-router";
import { getAdminRequest } from "@/lib/portal-requests.functions";
import { PageHead } from "@/components/portal/PortalShell";
import { RequestDetail, SafeNotFound, shortId } from "@/components/portal/request-display";

export const Route = createFileRoute("/_authenticated/admin/requests/$id")({
  head: () => ({ meta: [{ title: "Admin Request Details — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: async ({ params }) => { try { return await getAdminRequest({ data: { id: params.id } }); } catch { return { ok: false as const, error: "not_found" }; } },
  component: Detail,
});

function Detail() {
  const res = Route.useLoaderData();
  if (!res.ok) return <SafeNotFound backTo="/admin/requests" />;
  return (
    <>
      <p className="mb-3"><Link to="/admin/requests" className="ds-support font-semibold text-ds-link underline-offset-4 hover:underline">← All requests</Link></p>
      <PageHead title={(res.request as any).mfn_id ? `Request ${(res.request as any).mfn_id}` : `Request #${shortId(res.request.id)}`}>Read-only. Status changes are not enabled in this version.</PageHead>
      <RequestDetail r={res.request} showSource />
    </>
  );
}
