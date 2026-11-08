import { useState } from 'react';
import { DsButton } from '@/components/ds/controls';
import { ProviderDirectory } from './ProviderDirectory';
import type { NetworkProviderRow } from '@/lib/facility-providers.functions';
import {getConfirmedUsualProvider} from '@/lib/patient-provider.functions';
import {usePortalQuery} from '@/components/portal/preview-data';

export function PatientProviderPicker({ value, onChange }: { value: NetworkProviderRow | null; onChange: (v: NetworkProviderRow | null) => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(true);
  const usual=usePortalQuery({queryKey:['confirmed-usual-provider'],queryFn:()=>getConfirmedUsualProvider(),gcTime:0,staleTime:0});
  return <section className="space-y-3 border border-ds-sky-border bg-ds-sky p-4 rounded-ds" aria-label="Choose your provider">
    <h2 className="ds-subheading uppercase text-ds-primary">Your provider</h2>
    {value ? <div><p className="ds-body font-semibold">{value.business_name}</p><p className="ds-caption">{value.mfn_id} · {value.cities.join(', ')} · {value.service_types.join(', ')}</p><p className="ds-support mt-2">Only this provider receives your request. Acceptance is not guaranteed.</p></div> : <p className="ds-support">{usual.data?.workspace_id?'Your confirmed usual provider is available for selection.':'No confirmed usual provider is linked. Choose Find Another Provider to select a participating provider.'} Your request will not be broadcast.</p>}
    <div className="flex flex-wrap gap-2">
      {usual.data?.workspace_id && <DsButton size="sm" type="button" variant="secondary" onClick={()=>{if(usual.data?.workspace_id)onChange(usual.data);setOpen(false);}}>Send to my usual provider</DsButton>}
      <DsButton size="sm" type="button" variant="ghost" onClick={() => { setSaved(false); setOpen(true); }}>Find another provider</DsButton>
      {value && <DsButton size="sm" type="button" variant="ghost" onClick={() => { onChange(null); setOpen(false); }}>Remove selection</DsButton>}
    </div>
    {open && <div className="space-y-3"><DsButton size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Close provider list</DsButton><ProviderDirectory savedOnly={saved} onSelect={v => { onChange(v); setOpen(false); }} /></div>}
  </section>;
}