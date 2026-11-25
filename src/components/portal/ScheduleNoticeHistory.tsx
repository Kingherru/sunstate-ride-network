import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {DsButton} from '@/components/ds/controls';
import {getScheduleNoticeHistory,retryScheduleNotice} from '@/lib/schedule-roster.functions';
import {usePortalPreview,usePortalQuery} from './preview-data';
export function ScheduleNoticeHistory({workspaceId,date,drivers}:{workspaceId:string;date:string;drivers:{id:string;first_name:string;last_name:string}[]}){
 const preview=usePortalPreview(),get=useServerFn(getScheduleNoticeHistory),retry=useServerFn(retryScheduleNotice);const [busy,setBusy]=useState(''),[error,setError]=useState('');const q=usePortalQuery({queryKey:['schedule-notice-history',workspaceId,date],queryFn:()=>get({data:{workspaceId,date}})});
 return <details className="space-y-2"><summary className="ds-label cursor-pointer text-ds-primary">Driver notice status</summary>{preview.active?<p className="ds-caption">Synthetic preview — email and SMS are not sent.</p>:q.isError?<p className="ds-support">Notice status unavailable.</p>:!q.data?.length?<p className="ds-caption">No saved driver changes for this day.</p>:<ul className="space-y-2">{q.data.map(e=>{const d=drivers.find(d=>d.id===e.driverId);return <li key={e.id} className="ds-support"><span>{d?`${d.first_name} ${d.last_name}`:'Authorized driver'} · {e.kind.replaceAll('_',' ')} · Email: {e.email} · SMS: {e.sms}</span>{e.retryable&&<DsButton size="sm" variant="ghost" disabled={!!busy} onClick={async()=>{setBusy(e.id);setError('');try{await retry({data:{workspaceId,date,eventId:e.id}});await q.refetch();}catch{setError('Notice retry unavailable. The saved schedule is unchanged.');}finally{setBusy('');}}}>Retry failed channels</DsButton>}</li>;})}</ul>}{error&&<p role="alert">{error}</p>}</details>;
}
