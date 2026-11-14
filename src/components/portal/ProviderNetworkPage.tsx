import { useState } from 'react';
import { PageHead, panelCls } from './PortalShell';
import { ProviderDirectory } from '@/components/network/ProviderDirectory';
import { ProviderNetworkOffers, DistributionActivity } from './TripNetwork';
import { SegTabs } from './SegTabs';
import { TargetedPatientRequests } from './TargetedPatientRequests';
import { NetworkPayments } from './NetworkPayments';
import { NetworkSettlements } from './NetworkSettlements';
import { usePortalPreview } from './preview-data';
import { Link } from '@tanstack/react-router';
import {ContractorNetwork} from './ContractorNetwork';
import {ContractorAssignment} from './ContractorAssignment';

/** Provider-to-provider activity stays separate from owned trip operations. */
export function ProviderNetworkPage() {
  const [view, setView] = useState<'offers' | 'activity' | 'providers' | 'contractors' | 'patients' | 'payments' | 'settlements'>('offers');
  const preview = usePortalPreview();
  return <div className="min-w-0 space-y-5">
    <PageHead title="Provider network" />
    {preview.active && <p role="status" className="ds-label rounded-ds-sm ds-status-blue px-3 py-2 uppercase">Preview mode — demo data. Accept, Decline, Counter and Message are preview only — nothing is saved, sent or charged.</p>}
    {preview.active&&view==='contractors'&&<section className="space-y-3"><h2 className="ds-subheading text-ds-primary">Synthetic eligible ambulatory trip assignment</h2><ContractorAssignment tripId="00000000-0000-4000-8000-000000000048" service="ambulatory"/></section>}
    {!preview.active && <p className="ds-support">Use <strong>Message provider</strong> in the Provider directory to open (or start) your one conversation with a business, then continue it in <Link to="/portal/messaging" className="font-semibold text-ds-primary underline">Messaging</Link>.</p>}
    <SegTabs label="Network views" queryKey="view" value={view} onChange={setView} options={[{ value: 'offers', label: 'Received offers' }, { value: 'activity', label: 'Sent & negotiations' }, { value: 'payments', label: 'Accepted / active' }, { value: 'settlements', label: 'Settlements' }, { value: 'patients', label: 'Patient requests' }, { value: 'providers', label: 'Provider directory' },{value:'contractors',label:'Contractor connections'}]} />
    <section className={`${panelCls} p-4 sm:p-6`}>
      {view === 'offers' ? <ProviderNetworkOffers /> : view === 'contractors'?<ContractorNetwork/>: view === 'patients' ? <TargetedPatientRequests /> : view === 'activity' ? <DistributionActivity /> : view === 'payments' ? <NetworkPayments /> : view === 'settlements' ? <NetworkSettlements /> : <ProviderDirectory />}
    </section>
  </div>;
}
