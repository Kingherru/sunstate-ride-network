import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { getDriverSuggestion } from '@/lib/pass4r.functions';
import { DsCheckbox, DsField, DsSelect, DsInput } from '@/components/ds/controls';
import { usePortalQuery } from './preview-data';

export function PatientDriverSuggestion({ patientId, service, date, onConfirm }: { patientId: string; service: 'ambulatory' | 'wheelchair' | 'stretcher'; date?: string; onConfirm: (id: string | null,end?:string) => void }) {
  const get = useServerFn(getDriverSuggestion);
  const q = usePortalQuery({ queryKey: ['patient-driver-suggestion',patientId,service,date], queryFn: () => get({data:{patientId,service,...(date?{date}:{})}}) });
  const [choice,setChoice] = useState('');
  const [end,setEnd]=useState('');
  const [confirmed,setConfirmed] = useState(false);
  useEffect(() => { setChoice(q.data?.driverId ?? ''); setConfirmed(false); onConfirm(null); },[q.data,patientId,service,date,onConfirm]);
  return <section className="portal-business-section"><h3 className="portal-business-heading ds-label">Suggested driver · Not assigned</h3><div className="portal-business-body space-y-3">
    {q.isLoading && <p role="status" className="ds-support">Checking eligible drivers…</p>}
    {q.isError && <p role="status" className="ds-support">No eligible preferred driver</p>}
    {q.data?.warning && <p role="status" className="ds-support">{q.data.warning}</p>}
    <DsField label="Suggested driver" hint={q.data?.source==='preferred'?'Saved preferred driver':'Most recent eligible completed-trip driver, when available'}>{p=><DsSelect {...p} disabled={!q.data} value={choice} onChange={e=>{setChoice(e.target.value);setConfirmed(false);onConfirm(null);}}><option value="">Leave unassigned</option>{q.data?.options?.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</DsSelect>}</DsField>
    <DsField label="Reviewed driver end time">{p=><DsInput {...p} type="time" value={end} onChange={e=>{setEnd(e.target.value);setConfirmed(false);onConfirm(null);}}/>}</DsField>
    <DsCheckbox label="Confirm this driver when I submit the trip" disabled={!choice||!date||!end} checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);onConfirm(e.target.checked?choice:null,end);}}/>
  </div></section>;
}