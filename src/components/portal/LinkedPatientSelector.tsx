import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {Link} from '@tanstack/react-router';
import {getPatientLinkContext} from '@/lib/patient-trips.functions';
import {getLinkedPatientTripDefaults} from '@/lib/trip-defaults.functions';
import type {BasicTripDefaults} from '@/lib/trip-defaults.rules';
import {toast} from 'sonner';
import {DsButton,DsField,DsSelect} from '@/components/ds/controls';
import {usePortalQuery,usePortalPreview,previewBlocked} from './preview-data';
export function LinkedPatientSelector({value,onChange,onDefaults}:{value:string|null|undefined;onChange:(id:string|null)=>void;onDefaults?:(d:BasicTripDefaults)=>void}){
 const preview=usePortalPreview();const get=useServerFn(getPatientLinkContext);const defaults=useServerFn(getLinkedPatientTripDefaults);
 const q=usePortalQuery({queryKey:['patient-link-context'],queryFn:()=>get(),gcTime:0,staleTime:0});const [pending,setPending]=useState<string|null>(null);const [busy,setBusy]=useState(false);const data=q.data;
 if(!data?.workspaceId)return null;
 async function confirm(){if(preview.active)return previewBlocked();if(!data?.workspaceId)return;setBusy(true);try{const d=pending?await defaults({data:{sourceId:data.workspaceId,patientId:pending}}):null;onChange(pending||null);if(d)onDefaults?.(d);setPending(null);}catch{toast.error('Patient not available');}finally{setBusy(false);}}
 return <section className="border border-ds-border bg-ds-sky p-4"><DsField label="Linked patient account — Optional" hint="An active confirmed connection is required. Typed names never link an account.">{p=><DsSelect {...p} value={pending??value??''} onChange={e=>setPending(e.target.value)}><option value="">No patient account attached</option>{data.patients.map(x=><option key={x.workspace_id} value={x.workspace_id}>{x.display_name} · {x.mfn_id}</option>)}</DsSelect>}</DsField>{pending!==null && <div className="mt-3 space-y-3"><p className="ds-support">Attach this patient and fill their basic trip details? Only this request and resulting trip are shared.</p><DsButton type="button" variant="secondary" disabled={busy} onClick={confirm}>Confirm patient account</DsButton></div>}{value && <p className="ds-support mt-3">Patient attachment confirmed for review before submission.</p>}<Link to="/portal/account" search={{section:'connections'}} className="ds-support mt-3 inline-block text-ds-link underline">Review accepted connections</Link></section>;
}