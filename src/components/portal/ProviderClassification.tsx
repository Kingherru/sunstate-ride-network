import { useEffect,useState } from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {DsButton,DsCheckbox} from '@/components/ds/controls';
import {getProviderSetup,changeProviderSubtype} from '@/lib/provider-setup.functions';
import {saveServiceRoles} from '@/lib/pass4r.functions';
import {serviceRoles} from '@/lib/pass4r-rules';
import {usePortalPreview,usePortalQuery} from './preview-data';
const labels={nemt_business:'NEMT Business service role',independent_contractor:'Additional contractor service role',medical_delivery_driver:'Medical Delivery Driver'};
export function ProviderClassification({workspaceId}:{workspaceId:string}){
 const preview=usePortalPreview();const qc=useQueryClient();const get=useServerFn(getProviderSetup);const change=useServerFn(changeProviderSubtype);const save=useServerFn(saveServiceRoles);const q=usePortalQuery({queryKey:['provider-setup',workspaceId],queryFn:()=>get({data:{workspaceId}})});const [roles,setRoles]=useState<string[]>([]);const [busy,setBusy]=useState(false);
 useEffect(()=>{if(q.data)setRoles(q.data.provider_service_roles.length?q.data.provider_service_roles:[q.data.provider_subtype]);},[q.data]);
 return <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Provider classifications</h2><div className="portal-business-body space-y-4"><p className="ds-support">Primary account: {q.data?.provider_subtype==='independent_contractor'?'Independent Contractor':'NEMT Business Provider'}.</p><DsCheckbox label="I’m an Independent Contractor" checked={q.data?.provider_subtype==='independent_contractor'} disabled={preview.active||!q.data?.isOwner||busy} onChange={async e=>{const subtype=e.target.checked?'independent_contractor':'nemt_business';if(!window.confirm('Change your provider subtype? Requirements, eligibility and subscription rules may differ. Your MFN ID, records, evidence, relationships and subscriptions are retained. No verification, document approval, trip access or membership is granted. Contractor opportunities remain ambulatory only.'))return;setBusy(true);try{await change({data:{workspaceId,subtype,confirmed:true}});await qc.invalidateQueries();toast.success('Provider subtype saved. Eligibility requirements still apply.');}catch(e){toast.error(e instanceof Error?e.message:'Could not save subtype');}finally{setBusy(false);}}}/><p className="ds-support">Your existing service roles and verification evidence are retained. Service requirements still apply.</p></div></section>;
}