import {useEffect,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {RecordTable} from './RecordTable';
import {getPortalPreferences,savePortalPreferences} from '@/lib/portal-preferences.functions';
import {usePortalPreview,usePortalQuery} from './preview-data';
type Column<T>={id:'date'|'patient'|'route'|'driver'|'payment'|'payout'|'actions';label:string;render:(row:T)=>React.ReactNode;wrap?:boolean;minWidth?:number};
export function HistoryTable<T extends {id:string}>({rows,columns}:{rows:T[];columns:Column<T>[]}){
 const preview=usePortalPreview();const qc=useQueryClient();const get=useServerFn(getPortalPreferences);const save=useServerFn(savePortalPreferences);const q=usePortalQuery({queryKey:['portal-preferences'],queryFn:()=>get()});const [hidden,setHidden]=useState<string[]>([]);const [widths,setWidths]=useState<Record<string,number>>({});
 useEffect(()=>{if(q.data?.history_columns){setHidden(q.data.history_columns.hidden);setWidths(q.data.history_columns.widths);}},[q.data]);
 async function persist(h:string[],w:Record<string,number>){if(preview.active)return;try{await save({data:{history_columns:{hidden:h.filter((id):id is Exclude<Column<T>['id'],'actions'>=>id!=='actions'&&columns.some(c=>c.id===id)),widths:w}}});await qc.invalidateQueries({queryKey:['portal-preferences']});}catch{toast.error('Column preferences could not be saved.');}}
 return <RecordTable tableId="trip-history" rows={rows} rowKey={row=>row.id} columns={columns.map(c=>({...c,hideable:c.id!=='actions',wrap:c.wrap??c.id==='actions'}))} widths={widths} hidden={hidden} onPreferencesChange={(h,w)=>{setHidden(h);setWidths(w);void persist(h,w);}}/>;
}
