import {useServerFn} from '@tanstack/react-start';
import {useNavigate} from '@tanstack/react-router';
import {useState} from 'react';
import {toast} from 'sonner';
import {copyProviderTripToDraft} from '@/lib/provider-trip-copy.functions';
import {DsButton} from '@/components/ds/controls';
import {usePortalPreview,previewBlocked} from './preview-data';
export function CopyProviderTrip({tripId,workspaceId}:{tripId:string;workspaceId:string}) {
 const copy=useServerFn(copyProviderTripToDraft),navigate=useNavigate(),preview=usePortalPreview();const [busy,setBusy]=useState(false);
 return <DsButton type="button" variant="secondary" size="sm" disabled={busy} onClick={async()=>{if(preview.active){previewBlocked();return;}setBusy(true);try{const r=await copy({data:{tripId,workspaceId}});await navigate({to:'/portal/requests/new',search:{draft:r.draftId}});}catch{toast.error('Could not copy trip. Source trip unchanged.');}finally{setBusy(false);}}}>Copy to New Trip</DsButton>;
}