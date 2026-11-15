import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {DsButton,DsCheckbox,DsField,DsInput,DsSelect,DsTextarea} from '@/components/ds/controls';
import {usePortalQuery,usePortalMutation,usePortalPreview} from '@/components/portal/preview-data';
import {readMatchingPilot,saveMatchingPilot} from '@/lib/matching-pilot.functions';
import {EMPTY_PILOT,type PilotConfig} from '@/lib/matching-pilot-rules';
export function MatchingPilot(){
 const read=useServerFn(readMatchingPilot),save=useServerFn(saveMatchingPilot),qc=useQueryClient(),preview=usePortalPreview();
 const q=usePortalQuery({queryKey:['matching-pilot'],queryFn:()=>read()});
 const [draft,setDraft]=useState<PilotConfig|null>(null),[reason,setReason]=useState('');const c=draft??q.data?.config??EMPTY_PILOT;
 const update=(patch:Partial<PilotConfig>)=>setDraft({...c,...patch});
 const m=usePortalMutation({mutationFn:()=>save({data:{config:c,reason}}),onSuccess:()=>{setDraft(null);setReason('');qc.invalidateQueries({queryKey:['matching-pilot']});qc.invalidateQueries({queryKey:['admin','launch-readiness']});toast.success('Pilot configuration saved. Global matching remains off.');},onError:(e:Error)=>toast.error(e.message)});
 const workspaces=q.data?.workspaces??[];
 return <section className="portal-business-section mb-6"><h2 className="portal-business-heading ds-subheading">Matching Pilot — Master Admin</h2><form className="portal-business-body space-y-5" onSubmit={e=>{e.preventDefault();if(confirm('Save this controlled pilot configuration? No wave will be sent.'))m.mutate();}}>
 {!!q.error&&<p role="alert" className="text-ds-error">Pilot configuration unavailable. No changes permitted.</p>}
 <div className="grid gap-3 sm:grid-cols-3"><DsCheckbox label="Pilot enabled" checked={c.enabled} onChange={e=>update({enabled:e.target.checked})}/><DsCheckbox label="In-app offers enabled" checked={c.inApp} onChange={e=>update({inApp:e.target.checked})}/><DsCheckbox label="Emergency stop" checked={c.emergencyStop} onChange={e=>update({emergencyStop:e.target.checked})}/></div>
 <p className="ds-status-yellow p-3">Global matching OFF · Automatic advancement locked OFF · Email, SMS, push and reminders locked OFF</p>
 <div className="grid gap-4 sm:grid-cols-2">{(['senders','receivers'] as const).map(key=><fieldset className="border border-ds-border p-4 space-y-2" key={key}><legend className="ds-label">{key==='senders'?'Selected sending workspaces':'Selected receiving providers'}</legend>{!workspaces.length&&<p className="ds-support">No workspaces selected. Eligible accounts load only for the Master Admin.</p>}{workspaces.map(w=><DsCheckbox key={w.id} label={`${w.display_name} · ${w.mfn_id??'MFN unavailable'}`} checked={c[key].includes(w.id)} onChange={e=>update({[key]:e.target.checked?[...c[key],w.id]:c[key].filter(id=>id!==w.id)})}/>)}</fieldset>)}</div>
 <fieldset className="flex flex-wrap gap-4"><legend className="ds-label mb-2">Allowed transportation services</legend>{(['ambulatory','wheelchair','stretcher'] as const).map(s=><DsCheckbox key={s} label={s} checked={c.services.includes(s)} onChange={e=>update({services:e.target.checked?[...c.services,s]:c.services.filter(v=>v!==s)})}/>)}</fieldset>
 <div className="grid gap-4 sm:grid-cols-2"><DsField label="Allowed pickup cities (comma separated)">{p=><DsInput {...p} value={c.cities.join(', ')} onChange={e=>update({cities:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/>}</DsField><DsField label="Allowed pickup ZIP codes (comma separated)">{p=><DsInput {...p} value={c.zips.join(', ')} onChange={e=>update({zips:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/>}</DsField></div>
 <p className="ds-support">County and region-only scope is unavailable without authoritative pickup evidence. No distance or timezone is inferred.</p>
 <div className="grid gap-4 sm:grid-cols-3"><DsField label="Maximum candidates per manual wave">{p=><DsInput {...p} type="number" min={1} max={25} value={c.maxCandidates} onChange={e=>update({maxCandidates:Number(e.target.value)})}/>}</DsField><DsField label="Response window (minutes)">{p=><DsInput {...p} type="number" min={5} max={1440} value={c.responseMinutes} onChange={e=>update({responseMinutes:Number(e.target.value)})}/>}</DsField><DsField label="Maximum expansion">{p=><DsSelect {...p} value={c.maxRadius} onChange={e=>update({maxRadius:Number(e.target.value) as PilotConfig['maxRadius']})}>{[20,50,100,200].map(n=><option key={n} value={n}>{n} miles</option>)}</DsSelect>}</DsField></div>
 <DsField label="Reason for change">{p=><DsTextarea {...p} required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/>}</DsField>
 <DsButton type="submit" disabled={preview.active||!!q.error||q.isLoading||m.isPending||reason.trim().length<5}>Review & save pilot configuration</DsButton>
 <details><summary className="ds-label">Configuration change history</summary>{(q.data?.history??[]).map(h=><p className="ds-support mt-2" key={h.id}>{new Date(h.created_at).toLocaleString()} · {JSON.stringify(h.details)}</p>)}</details>
 </form></section>;
}