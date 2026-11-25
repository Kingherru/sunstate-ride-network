import {useEffect,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQueryClient} from '@tanstack/react-query';
import {DsButton,DsSelect,DsField} from '@/components/ds/controls';
import {getPortalPreferences,savePortalPreferences} from '@/lib/portal-preferences.functions';
import {usePortalPreview,usePortalQuery} from './preview-data';
export function ScheduleClockPreference(){
 const p=usePortalPreview(),qc=useQueryClient(),get=useServerFn(getPortalPreferences),save=useServerFn(savePortalPreferences);
 const q=usePortalQuery({queryKey:['portal-preferences'],queryFn:()=>get()});const [clock,setClock]=useState<'12'|'24'>('12'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>setClock(q.data?.schedule_clock??'12'),[q.data]);const dirty=clock!==(q.data?.schedule_clock??'12');
 return <form className="portal-business-section" onSubmit={async e=>{e.preventDefault();if(!dirty||busy)return;setBusy(true);setError('');try{if(p.active)qc.setQueryData(['portal-preview',p.examples!==false,'portal-preferences'],{...q.data,schedule_clock:clock});else{await save({data:{schedule_clock:clock}});await qc.invalidateQueries({queryKey:['portal-preferences']});}}catch{setError('Could not save the Schedule clock.');}finally{setBusy(false);}}}><h2 className="portal-business-heading ds-subheading uppercase">Schedule clock</h2><div className="portal-business-body"><DsField label="Time display">{props=><DsSelect {...props} value={clock} onChange={e=>setClock(e.target.value==='24'?'24':'12')}><option value="12">12 hour (AM / PM)</option><option value="24">24 hour</option></DsSelect>}</DsField>{error&&<p role="alert">{error}</p>}{p.active&&<p className="ds-caption">Synthetic preference only — no account changes.</p>}</div><div className="portal-business-actions"><DsButton type="submit" disabled={!dirty||busy||q.isError}>Save Changes</DsButton><DsButton type="button" variant="ghost" disabled={!dirty||busy} onClick={()=>setClock(q.data?.schedule_clock??'12')}>Cancel</DsButton></div></form>;
}
