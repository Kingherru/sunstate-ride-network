import { createFileRoute, Link } from "@tanstack/react-router";
import { canOpen } from "@/lib/admin-permissions";
import { listAdminRequests } from "@/lib/portal-requests.functions";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { RequestTable } from "@/components/portal/request-display";
import { DsEmpty } from "@/components/ds/feedback";
import { listNetworkActivity } from '@/lib/trip-network.functions';
import { getNeedsReviewCounts } from '@/lib/admin-management.functions';

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Overview — MY FLORIDA NEMT" }, { name: 'description', content: 'Scoped request review, provider distributions and account activity.' }, { property: 'og:title', content: 'Admin Overview — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Scoped request review, provider distributions and account activity.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: async ({ context }) => {
    if (!canOpen("/admin/requests", (context as any).perms)) return null;
    const [rows, network, review] = await Promise.all([listAdminRequests(), listNetworkActivity(), canOpen('/admin/people', (context as any).perms) ? getNeedsReviewCounts() : null]);
    return { rows, network, review };
  },
  component: Overview,
});

function Overview() {
  const data = Route.useLoaderData();
  if (data === null) return (
    <>
      <PageHead title="Admin">Your administrator account is active.</PageHead>
      <section className={panelCls}><DsEmpty title="No sections assigned yet">The Master Admin hasn't given you access to any admin sections or accounts. Ask them to assign your permissions.</DsEmpty></section>
    </>
  );
  const recent = data.rows.slice(0, 5);
  const groups = [
    { label: 'Requests needing review', count: data.rows.filter(r => ['new','pending'].includes(r.status || '')).length, to: '/admin/requests' },
    { label: 'Active provider distributions', count: data.network.filter(d => ['ready','offers_sent','negotiating','needs_attention'].includes(d.status)).length, to: '/admin/network' },
    { label: 'Offers / negotiations needing attention', count: data.network.filter(d => d.status === 'needs_attention' || d.offers.some(o => o.status === 'countered')).length, to: '/admin/network' },
    { label: 'Recently accepted trips', count: data.network.filter(d => d.status === 'provider_selected').length, to: '/admin/network' },
    ...(data.review ? [{ label: 'Accounts needing review', count: data.review.accountsNeedingClassification, to: '/admin/people' }] : []),
  ];
  return (
    <>
      <PageHead title="Admin" action={<Link to="/admin/requests" className={actionCls}>All requests</Link>}>
        Request review and controlled provider distribution.
      </PageHead>
      <nav aria-label="Admin activity" className="mb-6 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">{groups.map(g => <Link key={g.label} to={g.to as '/admin/network'} className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-ds-sm border border-ds-border bg-ds-sky/50 px-4 py-3 text-ds-primary ds-transition hover:border-ds-primary"><span className="ds-label min-w-0">{g.label}</span><strong className="ds-heading-3 tabular-nums">{g.count}</strong></Link>)}</nav>
      <section className={panelCls}>
        <h2 className="ds-subheading border-b border-ds-border px-4 py-3 uppercase text-ds-primary sm:px-5">Latest requests</h2>
        {recent.length === 0 ? <DsEmpty title="No requests yet" /> : <RequestTable rows={recent} detailBase="/admin/requests" showSource />}
      </section>
    </>
  );
}
