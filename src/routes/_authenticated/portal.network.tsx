import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ProviderDirectory } from "@/components/network/ProviderDirectory";
import { ProviderNetworkOffers, DistributionActivity } from '@/components/portal/TripNetwork';
import { SegTabs } from '@/components/portal/SegTabs';
import { useState } from 'react';

export const Route = createFileRoute("/_authenticated/portal/network")({
  head: () => ({ meta: [{ title: "Provider Network — MY FLORIDA NEMT" }, { name: 'description', content: 'Provider-to-provider offers, referrals, proposed amounts and network connections.' }, { property: 'og:title', content: 'Provider Network — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Protected provider-to-provider network activity.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalNetwork,
});

export function ProviderNetworkPage() {
  const [view, setView] = useState<'offers' | 'activity' | 'providers'>('offers');
  return (
    <>
      <PageHead title="Provider network" />
      <SegTabs label="Network views" value={view} onChange={setView} options={[{ value: 'offers', label: 'Offers & referrals' }, { value: 'activity', label: 'Sent & activity' }, { value: 'providers', label: 'Find providers' }]} />
      <section className={`${panelCls} p-4 sm:p-6`}>
        {view === 'offers' ? <ProviderNetworkOffers /> : view === 'activity' ? <DistributionActivity /> : <ProviderDirectory />}
      </section>
    </>
  );
}
function PortalNetwork() { return <ProviderNetworkPage />; }
