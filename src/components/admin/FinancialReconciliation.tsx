import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { listFinancialReconciliation } from '@/lib/financial-preparation.functions';
import {RecordTable} from '@/components/portal/RecordTable';
export function FinancialReconciliation(){
  const get=useServerFn(listFinancialReconciliation);const [search,setSearch]=useState('');
  const q=useQuery({queryKey:['financial-reconciliation'],queryFn:()=>get(),retry:false});
  if(q.isError)return <p className="ds-support">Transactional reconciliation is restricted to the Master Admin.</p>;
  const rows=(q.data?.rows??[]).filter(r=>JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const evidence=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))return null;const e=v as Record<string,unknown>;return {purpose:typeof e.purpose==='string'?e.purpose:'Unbound',expected:typeof e.expectedCents==='number'?e.expectedCents:null,actual:typeof e.authoritativeCents==='number'?e.authoritativeCents:null,currency:typeof e.currency==='string'?e.currency:'—',outcome:typeof e.outcome==='string'?e.outcome:'Not configured',reason:typeof e.reason==='string'?e.reason:'—'};};
  return <section className="space-y-4"><h2 className="ds-subheading uppercase text-ds-primary">Sandbox reconciliation</h2><p className="ds-support">Read only. Refunds, reversals and disputed evidence require Pass 4L policy review; no manual paid state or release.</p><input aria-label="Search reconciliation references" className="ds-input w-full" placeholder="Search event or obligation reference" value={search} onChange={e=>setSearch(e.target.value)}/><RecordTable tableId="admin-financial-reconciliation" rows={rows} rowKey={r=>r.event_id} columns={[
    {id:'event',label:'Event',width:300,render:r=><>{r.event_id} · {r.event_type}</>},
    {id:'purpose',label:'Purpose / environment',width:280,render:r=><>{evidence(r.preparation_evidence)?.purpose??'Legacy unbound'} · {r.environment} · {r.source}</>},
    {id:'amount',label:'Expected / authoritative',width:280,render:r=>{const e=evidence(r.preparation_evidence);return `${e?.expected??'—'} / ${e?.actual??'—'} ${e?.currency??''} minor units`;}},
    {id:'outcome',label:'Outcome / reason',width:320,wrap:true,render:r=><>{evidence(r.preparation_evidence)?.outcome??'Legacy evidence — not remapped'}<br/>{evidence(r.preparation_evidence)?.reason}</>},
  ]}/>{!rows.length&&<p className="ds-support">No matching sandbox events.</p>}</section>;
}