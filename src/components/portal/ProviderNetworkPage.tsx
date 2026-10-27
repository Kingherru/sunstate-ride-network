import { useState } from 'react';
import { PageHead, panelCls } from './PortalShell';
import { ProviderDirectory } from '@/components/network/ProviderDirectory';
import { ProviderNetworkOffers, DistributionActivity } from './TripNetwork';
import { SegTabs } from './SegTabs';
import { TargetedPatientRequests } from './TargetedPatientRequests';
import { NetworkPayments } from './NetworkPayments';

/** Provider-to-provider activity stays separate from owned trip operations. */
export function ProviderNetworkPage() {
  const [view, setView] = useState<'offers' | 'activity' | 'providers' | 'patients' | 'payments'>('offers');
  return <div className="space-y-5">
    <PageHead title="Provider network" />
    <SegTabs label="Network views" value={view} onChange={setView} options={[{ value: 'offers', label: 'Offers & referrals' }, { value: 'patients', label: 'Patient requests' }, { value: 'activity', label: 'Sent & activity' }, { value: 'payments', label: 'Payments' }, { value: 'providers', label: 'Find providers' }]} />
    <section className={`${panelCls} p-4 sm:p-6`}>
      {view === 'offers' ? <ProviderNetworkOffers /> : view === 'patients' ? <TargetedPatientRequests /> : view === 'activity' ? <DistributionActivity /> : view === 'payments' ? <NetworkPayments /> : <ProviderDirectory />}
    </section>
  </div>;
}