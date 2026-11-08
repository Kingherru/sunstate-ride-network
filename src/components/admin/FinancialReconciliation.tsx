import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { listFinancialReconciliation } from '@/lib/financial-preparation.functions';
export function FinancialReconciliation(){
  const get=useServerFn(listFinancialReconciliation);const [search,setSearch]=useState('');
  const q=useQuery({queryKey:['financial-reconciliation'],queryFn:()=>get(),retry:false});
  if(q.isError)return <p className="ds-support">Transactional reconciliation is restricted to the Master Admin.</p>;
  const rows=(q.data?.rows??[]).filter(r=>JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-4"><h2 className="ds-subheading uppercase text-ds-primary">Sandbox reconciliation</h2><p className="ds-support">Read only. Refunds, reversals and disputed evidence require Pass 4L policy review; no manual paid state or release.</p><input aria-label="Search reconciliation references" className="ds-input w-full" placeholder="Search event or obligation reference" value={search} onChange={e=>setSearch(e.target.value)}/><div className="overflow-x-auto"><table className="w-full text-left ds-support"><thead><tr><th className="p-2">Event</th><th className="p-2">Purpose / environment</th><th className="p-2">Evidence / outcome</th></tr></thead><tbody>{rows.map(r=><tr key={r.event_id} className="border-t border-ds-border"><td className="p-2 break-all">{r.event_id}<br/>{r.event_type}</td><td className="p-2">{r.environment} · {r.source}</td><td className="p-2">{r.preparation_evidence?'Pending policy review / preparation evidence':'Legacy evidence — not remapped'}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="ds-support">No matching sandbox events.</p>}</section>;
}