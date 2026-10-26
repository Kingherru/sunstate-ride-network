import { useState } from 'react';
import { PageHead, panelCls } from './PortalShell';
import { ProviderDirectory } from '@/components/network/ProviderDirectory';
import { ProviderNetworkOffers, DistributionActivity } from './TripNetwork';
import { SegTabs } from './SegTabs';

/** Provider-to-provider activity stays separate from owned trip operations. */
export function ProviderNetworkPage() {
  const [view, setView] = useState<'offers' | 'activity' | 'providers'>('offers');
  return <div className="space-y-5">
    <PageHead title="Provider network" />
    <SegTabs label="Network views" value={view} onChange={setView} options={[{ value: 'offers', label: 'Offers & referrals' }, { value: 'activity', label: 'Sent & activity' }, { value: 'providers', label: 'Find providers' }]} />
    <section className={`${panelCls} p-4 sm:p-6`}>
      {view === 'offers' ? <ProviderNetworkOffers /> : view === 'activity' ? <DistributionActivity /> : <ProviderDirectory />}
    </section>
  </div>;
}