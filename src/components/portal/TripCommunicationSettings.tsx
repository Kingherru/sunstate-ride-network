import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { DsButton, DsCheckbox, DsField, DsInput } from '@/components/ds/controls';
import { setTripDispatchContact, setPatientDriverContact } from '@/lib/trip-invoices.functions';
import { getCustomerCommunicationSettings, saveCustomerCommunicationSettings } from '@/lib/communications.functions';
import { usePortalQuery, usePortalPreview, previewBlocked } from './preview-data';
export function TripDispatchSettings({ workspaceId }: { workspaceId: string }) {
  const preview = usePortalPreview(), get = useServerFn(getCustomerCommunicationSettings), save = useServerFn(saveCustomerCommunicationSettings);
  const q = usePortalQuery({queryKey:['customer-communication-settings',workspaceId],queryFn:()=>get({data:{workspaceId}}),enabled:!preview.active});
  const [settings,setSettings]=useState({businessName:'',dispatchPhone:'',email:'',shareDriverName:false,shareDriverPhone:false});
  const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{if(q.data&&!preview.active)setSettings(q.data);},[q.data,preview.active]);
  const change=(key: keyof typeof settings,value:string|boolean)=>{setSettings(s=>({...s,[key]:value}));setConfirmed(false);};
  return <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Customer-facing trip contacts</h2><div className="portal-business-body space-y-4">
   {!!q.error && <p role="alert" className="ds-status-red p-3">Communication settings unavailable.</p>}
   <div className="grid gap-4 sm:grid-cols-2"><DsField label="Approved business / dispatch name">{p=><DsInput {...p} maxLength={160} value={settings.businessName} onChange={e=>change('businessName',e.target.value)}/>}</DsField><DsField label="Approved dispatch phone">{p=><DsInput {...p} type="tel" maxLength={32} value={settings.dispatchPhone} onChange={e=>change('dispatchPhone',e.target.value)}/>}</DsField><DsField label="Customer-facing email — optional">{p=><DsInput {...p} type="email" maxLength={254} value={settings.email} onChange={e=>change('email',e.target.value)}/>}</DsField></div>
   <DsCheckbox label="Allow assigned driver name in customer updates" checked={settings.shareDriverName} onChange={e=>change('shareDriverName',e.target.checked)}/>
   <DsCheckbox label="Allow driver phone only with separate provider and driver confirmation for each assigned trip" checked={settings.shareDriverPhone} onChange={e=>change('shareDriverPhone',e.target.checked)}/>
   <p className="ds-caption">Per-trip withholding overrides these choices. No driver assignment or schedule changes. Delivery remains off.</p>
   <DsCheckbox label="I approve these contacts for customer-facing communications after trip approval" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
   <DsButton disabled={preview.active||!q.data||!confirmed||busy} onClick={async()=>{if(preview.active)return previewBlocked();setBusy(true);try{await save({data:{workspaceId,settings,confirmed:true}});await q.refetch();setConfirmed(false);toast.success('Customer contact settings saved.');}catch{toast.error('Communication settings could not be saved.');}finally{setBusy(false);}}}>Confirm contact settings</DsButton>
  </div></section>;
}
export function AssignedDriverContactConsent({ tripId, driverId }: { tripId: string; driverId: string }) {
  const preview = usePortalPreview(); const save = useServerFn(setPatientDriverContact); const [phone, setPhone] = useState(''); const [providerConfirmed, setProviderConfirmed] = useState(false); const [driverConfirmed, setDriverConfirmed] = useState(false); const [busy, setBusy] = useState(false);
  return <section className="space-y-4 border-t border-ds-border pt-4"><h3 className="ds-label">This assigned trip's driver contact</h3><DsField label="Trip-approved driver phone (blank removes sharing)">{p => <DsInput {...p} type="tel" maxLength={32} value={phone} onChange={e => { setPhone(e.target.value); setProviderConfirmed(false); setDriverConfirmed(false); }}/>}</DsField><DsCheckbox label="Provider confirms sharing this number for this trip only" checked={providerConfirmed} onChange={e => setProviderConfirmed(e.target.checked)}/><DsCheckbox label="The assigned driver has confirmed sharing this number for this trip" checked={driverConfirmed} onChange={e => setDriverConfirmed(e.target.checked)}/><DsButton disabled={busy || !providerConfirmed || !driverConfirmed} onClick={async () => { if (preview.active) return previewBlocked(); setBusy(true); try { await save({ data: { tripId, driverId, phone: phone || null, providerConfirmed: true, driverConfirmed: true } }); toast.success('Trip contact preference saved.'); } catch { toast.error('Assigned trip contact unavailable.'); } finally { setBusy(false); } }}>Confirm per-trip contact</DsButton></section>;
}