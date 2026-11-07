import { createFileRoute, Link } from "@tanstack/react-router";
import { getPortalRequest } from "@/lib/portal-requests.functions";
import { PageHead } from "@/components/portal/PortalShell";
import { RequestDetail, SafeNotFound, shortId } from "@/components/portal/request-display";

export const Route = createFileRoute("/_authenticated/portal/requests/$id")({
  head: () => ({ meta: [{ title: "Request Details — MY FLORIDA NEMT Portal" },{name:'description',content:'Authorized transportation request details.'},{property:'og:title',content:'Request Details — MY FLORIDA NEMT Portal'},{property:'og:description',content:'Private details of your authorized transportation request.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}, { name: "robots", content: "noindex, nofollow" }] }),
  // Malformed IDs fail validation and land on the same safe result as unauthorized ones.
  loader: async ({ params }) => { try { return await getPortalRequest({ data: { id: params.id } }); } catch { return { ok: false as const, error: "not_found" }; } },
  component: Detail,
});

function Detail() {
  const res = Route.useLoaderData();
  if (!res.ok) return <SafeNotFound backTo="/portal/requests" />;
  return (
    <>
      <p className="mb-3"><Link to="/portal/requests" className="ds-support font-semibold text-ds-link underline-offset-4 hover:underline">← All requests</Link></p>
      <PageHead title={(res.request as any).mfn_id ? `Request ${(res.request as any).mfn_id}` : `Request #${shortId(res.request.id)}`}>Submitted requests are reviewed by participating providers; submission is not a confirmation.</PageHead>
      <RequestDetail r={res.request} />
    </>
  );
}
