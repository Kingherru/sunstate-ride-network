import { useState } from 'react';
import { PageHead, panelCls } from './PortalShell';
import { ProviderDirectory } from '@/components/network/ProviderDirectory';
import { ProviderNetworkOffers, DistributionActivity } from './TripNetwork';
import { SegTabs } from './SegTabs';
import { TargetedPatientRequests } from './TargetedPatientRequests';
import { NetworkPayments } from './NetworkPayments';
import { NetworkSettlements } from './NetworkSettlements';

/** Provider-to-provider activity stays separate from owned trip operations. */
export function ProviderNetworkPage() {
  const [view, setView] = useState<'offers' | 'activity' | 'providers' | 'patients' | 'payments' | 'settlements'>('offers');
  return <div className="space-y-5">
    <PageHead title="Provider network" />
    <SegTabs label="Network views" value={view} onChange={setView} options={[{ value: 'offers', label: 'Received offers' }, { value: 'activity', label: 'Sent & negotiations' }, { value: 'payments', label: 'Accepted / active' }, { value: 'settlements', label: 'Settlements' }, { value: 'patients', label: 'Patient requests' }, { value: 'providers', label: 'Provider directory' }]} />
    <section className={`${panelCls} p-4 sm:p-6`}>
      {view === 'offers' ? <ProviderNetworkOffers /> : view === 'patients' ? <TargetedPatientRequests /> : view === 'activity' ? <DistributionActivity /> : view === 'payments' ? <NetworkPayments /> : view === 'settlements' ? <NetworkSettlements /> : <ProviderDirectory />}
    </section>
  </div>;
}
