import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { getContractorRelationships, listContractorDirectory } from '@/lib/contractor.functions';
import { usePortalQuery } from './preview-data';
export function ConnectedProviders({workspaceId,contractor}:{workspaceId:string;contractor:boolean}) {
 const get=useServerFn(getContractorRelationships); const list=useServerFn(listContractorDirectory);
 const q=usePortalQuery({queryKey:['contractor-relationships',workspaceId],queryFn:()=>get({data:{workspaceId}})});
 const directory=usePortalQuery({queryKey:['contractor-directory'],queryFn:()=>list()});
 const rows=q.data?.connections.filter(c=>c.active)??[];
 return <section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">{contractor?'Connected companies':'Connected contractors'}</h2><div className="portal-business-body space-y-3">{q.isError?<p role="status" className="ds-support">Connections require authorized provider management access.</p>:rows.length?<ul className="divide-y divide-ds-border">{rows.map(c=>{const target=c.workspace_a===workspaceId?c.workspace_b:c.workspace_a;return <li key={c.id} className="ds-support py-3">{directory.data?.find(d=>d.workspace_id===target)?.business_name??'Connected provider'} · Active</li>;})}</ul>:<p className="ds-support">No accepted contractor connections.</p>}<Link to="/portal/network" search={{view:'contractors',relationship:'active'}} className="ds-label text-ds-link underline">Open Network relationships</Link><p className="ds-caption">Independent accounts remain separate. A connection grants no workspace membership or unrelated record access.</p></div></section>;
}