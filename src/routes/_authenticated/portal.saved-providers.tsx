import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ProviderDirectory } from "@/components/network/ProviderDirectory";

export const Route = createFileRoute("/_authenticated/portal/saved-providers")({
  head: () => ({ meta: [{ title: "Saved Providers — MY FLORIDA NEMT" }, { name: 'description', content: 'Your saved transportation providers.' }, { property: 'og:title', content: 'Saved Providers — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Your saved transportation providers.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: () => { throw redirect({ to: '/portal/find-providers', search: { tab: 'saved' } }); },
  component: PortalSavedProviders,
});

function PortalSavedProviders() {
  return (
    <>
      <PageHead title="Saved Providers" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ProviderDirectory savedOnly />
      </section>
    </>
  );
}
