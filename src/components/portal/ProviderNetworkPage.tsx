import { useState } from 'react';
import { PageHead } from './PortalShell';
import { ProviderDirectory } from '@/components/network/ProviderDirectory';
import { ProviderNetworkOffers, DistributionActivity } from './TripNetwork';
import { PortalTabbedLayout } from './PortalTabbedLayout';
import { TargetedPatientRequests } from './TargetedPatientRequests';
import { NetworkPayments } from './NetworkPayments';
import { NetworkSettlements } from './NetworkSettlements';
import { usePortalPreview } from './preview-data';
import { Link } from '@tanstack/react-router';
import {ContractorNetwork} from './ContractorNetwork';
import {ContractorAssignment} from './ContractorAssignment';
import {useServerFn} from '@tanstack/react-start';
import {getNetworkAccess,getNetworkActivityCounts,markNetworkViewRead} from '@/lib/network-access.functions';
import {usePortalQuery} from './preview-data';
import {useTrainingCart} from '@/components/training/TrainingCart';
import {DsButton} from '@/components/ds/controls';

/** Provider-to-provider activity stays separate from owned trip operations. */
export function ProviderNetworkPage() {
  const [view, setView] = useState<'offers' | 'activity' | 'providers' | 'contractors' | 'patients' | 'payments' | 'settlements'>('offers');
  const preview = usePortalPreview();
  const get=useServerFn(getNetworkAccess),cart=useTrainingCart();
  const access=usePortalQuery({queryKey:['network-access'],queryFn:()=>get()});
  const inactive=!access.data?.entitled;
  const getCounts=useServerFn(getNetworkActivityCounts),markRead=useServerFn(markNetworkViewRead);
  const counts=usePortalQuery({queryKey:['network-view-counts'],queryFn:()=>getCounts()});
  const [demoInactive,setDemoInactive]=useState(false),[readError,setReadError]=useState('');
  const badge=(key:string)=>counts.data?.[key] || undefined;
  return <div className="min-w-0 space-y-5">
    <PageHead title="Provider network" />
    {preview.active&&<div className="portal-toolbar"><DsButton size="sm" variant="ghost" onClick={()=>setDemoInactive(!demoInactive)}>{demoInactive?'Preview active membership':'Preview inactive membership'}</DsButton></div>}
    {(inactive||demoInactive)&&<section className="portal-business-section"><h2 className="portal-business-heading ds-subheading">Network membership inactive</h2><div className="portal-business-body space-y-3"><p className="ds-body">{access.data?.contractor?'Independent Contractor membership is $20/month; eligibility and accepted relationships are still required.':'Referral actions require the $10/month Network add-on and an eligible Provider base membership.'} Authorized history and provider information remain available.</p><DsButton disabled={preview.active||!access.data?.canPurchase} onClick={()=>{cart.setMembership(access.data?.contractor?{contractor:true}:{base:!access.data?.baseActive,network:true,baseActive:access.data?.baseActive??false,addonActive:false});cart.open();}}>Join Our Network</DsButton><p className="ds-support">Adding membership to your cart does not activate access. Checkout remains unavailable.</p></div></section>}
    {preview.active && <p role="status" className="ds-label rounded-ds-sm ds-status-blue px-3 py-2 uppercase">Preview mode — demo data. Accept, Decline, Counter and Message are preview only — nothing is saved, sent or charged.</p>}
    <div className="portal-toolbar"><DsButton size="sm" variant="ghost" disabled={preview.active||!counts.data?.[view]} onClick={async()=>{setReadError('');try{await markRead({data:{view}});await counts.refetch();}catch{setReadError('Network activity could not be marked read.');}}}>Mark activity as read</DsButton></div>{readError&&<p role="alert" className="text-ds-error">{readError}</p>}
    {preview.active&&view==='contractors'&&<section className="space-y-3"><h2 className="ds-subheading text-ds-primary">Synthetic eligible ambulatory trip assignment</h2><ContractorAssignment tripId="00000000-0000-4000-8000-000000000048" service="ambulatory"/></section>}
    <PortalTabbedLayout label="Network views" queryKey="view" value={view} onChange={setView} options={[{ value: 'offers', label: 'Received offers',badge:badge('offers') }, { value: 'activity', label: 'Sent & negotiations',badge:badge('activity') }, { value: 'payments', label: 'Accepted / active',badge:badge('payments') }, { value: 'settlements', label: 'Settlements',badge:badge('settlements') }, { value: 'patients', label: 'Patient requests',badge:badge('patients') }, { value: 'providers', label: 'Provider directory',badge:badge('providers') },{value:'contractors',label:'Contractor connections',badge:badge('contractors')}]} >
    <section className="min-w-0 py-2">
      {view === 'offers' ? <ProviderNetworkOffers actionsDisabled={inactive || demoInactive}/> : view === 'contractors'?<ContractorNetwork/>: view === 'patients' ? <TargetedPatientRequests /> : view === 'activity' ? <DistributionActivity /> : view === 'payments' ? <NetworkPayments /> : view === 'settlements' ? <NetworkSettlements /> : <ProviderDirectory providerOperations />}
    </section>
    </PortalTabbedLayout>
  </div>;
}
