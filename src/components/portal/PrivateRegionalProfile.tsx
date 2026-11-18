import {useEffect,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {toast} from 'sonner';
import {DsButton} from '@/components/ds/controls';
import {RegionalAreaEditor,emptyAreaSettings,type AreaSettings} from '@/components/forms/RegionalAreaEditor';
import {readPrivateRegionalProfile,savePrivateRegionalProfile} from '@/lib/regional.functions';
import {serviceAreaSchema} from '@/lib/us-geography';
import {usePortalPreview,usePortalQuery} from './preview-data';
export function PrivateRegionalProfile({workspaceId,canEdit=true}:{workspaceId?:string;canEdit?:boolean}){
 const preview=usePortalPreview(),read=useServerFn(readPrivateRegionalProfile),save=useServerFn(savePrivateRegionalProfile);
 const q=usePortalQuery({queryKey:['private-regional-profile',workspaceId??'person'],queryFn:()=>read({data:{workspaceId}})});
 const [value,setValue]=useState<AreaSettings>(emptyAreaSettings),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');const saved=serviceAreaSchema.safeParse(q.data);const dirty=JSON.stringify(value)!==JSON.stringify(saved.success?saved.data:emptyAreaSettings);const valid=serviceAreaSchema.safeParse(value).success;
 useEffect(()=>{const p=serviceAreaSchema.safeParse(q.data);if(p.success)setValue(p.data);},[q.data]);
 return <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Private location preferences</h2><div className="portal-business-body space-y-4"><fieldset disabled={!canEdit||busy} className="min-w-0 border-0"><RegionalAreaEditor value={value} onChange={setValue}/></fieldset>{!!q.error&&<p role="alert">Location preferences unavailable.</p>}<p className="ds-support">Your location details remain private and subject to review.</p><DsButton disabled={!canEdit||!dirty||!valid||busy||preview.active||q.isPending||!!q.error} onClick={async()=>{if(preview.active||!canEdit||!dirty||!valid||busy||!q.data)return;const p=serviceAreaSchema.safeParse(value);if(!p.success){toast.error('Review state, ZIP, timezone and region.');return;}setBusy(true);setMessage('');try{await save({data:{workspaceId,settings:p.data}});await q.refetch();setMessage('Changes saved.');toast.success('Location preferences saved and confirmed.');}catch(e){setMessage('Could not save. Previously saved locations are unchanged.');toast.error(e instanceof Error?e.message:'Could not save profile.');}finally{setBusy(false);}}}>{busy?'Saving…':'Save Changes'}</DsButton><DsButton type="button" variant="ghost" disabled={busy||!dirty} onClick={()=>{setValue(saved.success?saved.data:emptyAreaSettings);setMessage('');}}>Cancel</DsButton><p role="status" className="ds-caption">{!canEdit?'Read-only location information.':preview.active?'Preview mode — nothing is saved.':message||(dirty?valid?'Unsaved changes.':'Review state, ZIP, timezone and region.':'')}</p></div></section>;
}