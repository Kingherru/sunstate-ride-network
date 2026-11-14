import { createFileRoute } from "@tanstack/react-router";
import { PortalTabbedLayout } from '@/components/portal/PortalTabbedLayout';
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ProviderDirectory } from "@/components/network/ProviderDirectory";

export const Route = createFileRoute("/_authenticated/portal/find-providers")({
  head: () => ({ meta: [{ title: "Providers — MY FLORIDA NEMT" }, { name: 'description', content: 'Find authorized directory providers and your saved providers.' }, { property: 'og:title', content: 'Providers — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Find authorized directory providers and your saved providers.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === 'string' ? s.tab : 'find' }),
  component: PortalFindProviders,
});

function PortalFindProviders() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selected = tab === 'saved' ? 'saved' : 'find';
  return (
    <>
      <PageHead title="Providers" />
      <PortalTabbedLayout label="Providers sections" value={selected} onChange={t => navigate({ search: prev => ({ ...prev, tab: t }) })} options={[{ value: 'find', label: 'Find' }, { value: 'saved', label: 'Saved' }]} >
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ProviderDirectory key={selected} savedOnly={selected === 'saved'} />
      </section>
    </PortalTabbedLayout>
    </>
  );
}
