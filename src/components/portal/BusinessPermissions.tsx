import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsField, DsSelect } from '@/components/ds/controls';
import { usePortalQuery, usePortalMutation } from '@/components/portal/preview-data';
import { listBusinessMembers, setBusinessMemberPermissions } from '@/lib/business-records.functions';
export function BusinessPermissions({ workspaceId }: { workspaceId: string }) {
  const list = useServerFn(listBusinessMembers), save = useServerFn(setBusinessMemberPermissions), qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ['business-members',workspaceId], queryFn: () => list({data:{workspace_id:workspaceId}}) });
  const m = usePortalMutation({ mutationFn: (data: { workspace_id: string; user_id: string; permissions: Record<'vehicles'|'drivers'|'contacts'|'payers','none'|'read'|'manage'>; manage_trips: boolean }) => save({data}), onSuccess: () => { qc.invalidateQueries({queryKey:['business-members']}); toast.success('Business permissions updated.'); }, onError:(e:Error)=>toast.error(e.message) });
  return <div className="mt-8 space-y-4"><h2 className="ds-subheading text-ds-primary">Team record permissions</h2>{(q.data??[]).map(member=>{
    const permissions=member.record_permissions as Record<'vehicles'|'drivers'|'contacts'|'payers','none'|'read'|'manage'>;
    const fixed=member.role==='owner'||member.role==='admin'||member.is_contractor;
    return <div key={member.user_id} className="py-4 border-t border-ds-border space-y-3"><p className="ds-support font-mono break-all">{member.user_id} · {member.is_contractor?'Contractor':member.role}</p>{fixed?<p className="ds-support">{member.is_contractor?'Assignment-specific access only.':'All business records: Manage'}</p>:<div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">{(['vehicles','drivers','contacts','payers'] as const).map(kind=><DsField label={kind} key={kind}>{p=><DsSelect {...p} disabled={m.isPending} value={permissions[kind]||'none'} onChange={e=>m.mutate({workspace_id:workspaceId,user_id:member.user_id,permissions:{...permissions,[kind]:e.target.value},manage_trips:member.can_manage_trips})}><option value="none">Assigned/shared only</option><option value="read">Read</option><option value="manage">Manage</option></DsSelect>}</DsField>)}<DsField label="Trip management">{p=><DsSelect {...p} disabled={m.isPending} value={member.can_manage_trips?'manage':'none'} onChange={e=>m.mutate({workspace_id:workspaceId,user_id:member.user_id,permissions,manage_trips:e.target.value==='manage'})}><option value="none">No access</option><option value="manage">Manage</option></DsSelect>}</DsField></div>}</div>;
  })}</div>;
}