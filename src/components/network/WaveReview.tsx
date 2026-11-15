import {useServerFn} from '@tanstack/react-start';
import {previewNearbyWave,withdrawNearbyWave} from '@/lib/nearby-matching.functions';
import {usePortalQuery,usePortalMutation} from '@/components/portal/preview-data';
import {DsButton,DsField,DsSelect} from '@/components/ds/controls';
import {useState} from 'react';
import {sendNetworkWave} from '@/lib/trip-network.functions';
import {confirmPilotTimezone} from '@/lib/matching-pilot.functions';
import {toast} from 'sonner';
import {useQueryClient} from '@tanstack/react-query';
export function WaveReview({distributionId}:{distributionId:string}){
 const read=useServerFn(previewNearbyWave),withdraw=useServerFn(withdrawNearbyWave),send=useServerFn(sendNetworkWave),zone=useServerFn(confirmPilotTimezone),qc=useQueryClient();const [timezone,setTimezone]=useState('');
 const q=usePortalQuery({queryKey:['nearby-wave-review',distributionId],queryFn:()=>read({data:{distributionId}})});
 const refresh=()=>{qc.invalidateQueries({queryKey:['network-activity']});qc.invalidateQueries({queryKey:['nearby-wave-review']});};
 const m=usePortalMutation({mutationFn:()=>withdraw({data:{distributionId}}),onSuccess:()=>{refresh();toast.success('Distribution withdrawn; history retained.');},onError:()=>toast.error('Withdrawal unavailable.')});
 const wave=usePortalMutation({mutationFn:()=>send({data:{distribution_id:distributionId}}),onSuccess:()=>{refresh();toast.success('Manual in-app wave recorded. No external delivery.');},onError:(e:Error)=>toast.error(e.message)});
 const time=usePortalMutation({mutationFn:()=>zone({data:{distributionId,timezone:timezone as 'America/New_York'|'America/Chicago'}}),onSuccess:refresh,onError:(e:Error)=>toast.error(e.message)});
 if(q.isLoading)return <p>Checking matching eligibility…</p>;if(q.error)return <p className="text-ds-error">Candidate review unavailable; no offers created.</p>;const r=q.data;if(!r||!('eligible'in r))return null;
 return <section className="space-y-3 border border-ds-border p-4"><h3 className="ds-label">Manual pilot wave review</h3><p className="ds-body">{r.eligible} eligible candidates · Next stage: {r.radius} miles · {r.geography??'General geography unavailable'}</p><p className="ds-status-yellow p-2">{r.enabled?'Explicit confirmation required; no automatic advancement.':r.reason||'Pilot intentionally OFF. Preview creates no offers.'}</p>
 {!r.timezone&&<div className="space-y-2"><DsField label="Confirm pickup timezone">{p=><DsSelect {...p} value={timezone} onChange={e=>setTimezone(e.target.value)}><option value="">Select explicitly</option><option value="America/New_York">Eastern — America/New_York</option><option value="America/Chicago">Central — America/Chicago</option></DsSelect>}</DsField><DsButton variant="secondary" disabled={!timezone||time.isPending} onClick={()=>time.mutate()}>Confirm timezone</DsButton></div>}
 <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(r.excluded).map(([reason,n])=><div key={reason} className="ds-support">{reason}: {n}</div>)}</dl>{r.candidates.map(c=><div key={c.workspace} className="ds-support border-t border-ds-border pt-2">{c.explanation.join(' · ')}</div>)}
 <div className="flex flex-wrap gap-2"><DsButton disabled={!r.enabled||!r.eligible||wave.isPending} onClick={()=>{if(confirm(`Send one manual wave to up to ${r.eligible} eligible candidates for ${r.geography??'the reviewed general route'}, within ${r.radius} miles?`))wave.mutate();}}>Send manual pilot wave</DsButton><DsButton variant="secondary" disabled={m.isPending} onClick={()=>{if(confirm('Withdraw pending offers? History is retained.'))m.mutate();}}>Withdraw distribution</DsButton></div></section>;
}