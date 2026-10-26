import { useState } from 'react';
import { DsButton } from '@/components/ds/controls';
import { ProviderDirectory } from './ProviderDirectory';
import type { NetworkProviderRow } from '@/lib/facility-providers.functions';

export function PatientProviderPicker({ value, onChange }: { value: NetworkProviderRow | null; onChange: (v: NetworkProviderRow | null) => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(true);
  return <section className="space-y-3 border border-ds-sky-border bg-ds-sky p-4 rounded-ds" aria-label="Choose your provider">
    <h2 className="ds-subheading uppercase text-ds-primary">Your provider</h2>
    {value ? <div><p className="ds-body font-semibold">{value.business_name}</p><p className="ds-caption">{value.mfn_id} · {value.cities.join(', ')} · {value.service_types.join(', ')}</p><p className="ds-support mt-2">Only this provider receives your request. Acceptance is not guaranteed.</p></div> : <p className="ds-support">No provider selected. Your request stays under MY FLORIDA NEMT review; it will not be broadcast.</p>}
    <div className="flex flex-wrap gap-2">
      <DsButton size="sm" type="button" variant="secondary" onClick={() => { setSaved(true); setOpen(true); }}>Saved / usual providers</DsButton>
      <DsButton size="sm" type="button" variant="ghost" onClick={() => { setSaved(false); setOpen(true); }}>{value ? 'Change provider' : 'Find providers'}</DsButton>
      {value && <DsButton size="sm" type="button" variant="ghost" onClick={() => { onChange(null); setOpen(false); }}>Remove selection</DsButton>}
    </div>
    {open && <div className="space-y-3"><DsButton size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Close provider list</DsButton><ProviderDirectory savedOnly={saved} onSelect={v => { onChange(v); setOpen(false); }} /></div>}
  </section>;
}