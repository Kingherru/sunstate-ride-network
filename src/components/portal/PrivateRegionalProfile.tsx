import {useEffect,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {toast} from 'sonner';
import {DsButton} from '@/components/ds/controls';
import {RegionalAreaEditor,emptyAreaSettings,type AreaSettings} from '@/components/forms/RegionalAreaEditor';
import {readPrivateRegionalProfile,savePrivateRegionalProfile} from '@/lib/regional.functions';
import {serviceAreaSchema} from '@/lib/us-geography';
import {usePortalPreview,usePortalQuery} from './preview-data';
export function PrivateRegionalProfile({workspaceId}:{workspaceId?:string}){
 const preview=usePortalPreview(),read=useServerFn(readPrivateRegionalProfile),save=useServerFn(savePrivateRegionalProfile);
 const q=usePortalQuery({queryKey:['private-regional-profile',workspaceId??'person'],queryFn:()=>read({data:{workspaceId}})});
 const [value,setValue]=useState<AreaSettings>(emptyAreaSettings),[busy,setBusy]=useState(false);
 useEffect(()=>{const p=serviceAreaSchema.safeParse(q.data);if(p.success)setValue(p.data);},[q.data]);
 return <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Private regional profile</h2><div className="portal-business-body space-y-4"><RegionalAreaEditor value={value} onChange={setValue}/>{!!q.error&&<p role="alert">Private regional profile unavailable.</p>}<p className="ds-support">Private account geography · Entered information remains subject to review. Directory consent and service eligibility are separate.</p><DsButton disabled={busy||preview.active||q.isPending||!!q.error} onClick={async()=>{const p=serviceAreaSchema.safeParse(value);if(!p.success){toast.error('Review state, ZIP, timezone and region.');return;}setBusy(true);try{await save({data:{workspaceId,settings:p.data}});await q.refetch();toast.success('Private regional profile saved and confirmed.');}catch(e){toast.error(e instanceof Error?e.message:'Could not save profile.');}finally{setBusy(false);}}}>Save regional profile</DsButton></div></section>;
}