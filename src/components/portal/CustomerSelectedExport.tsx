import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {toast} from 'sonner';
import {DsButton,DsCheckbox} from '@/components/ds/controls';
import {readCustomerSelectedExport,readAdminSelectedRequestExport} from '@/lib/selected-trip-exports.functions';
import {exportTable,type ExportFormat} from '@/lib/table-export';
import {usePortalPreview} from './preview-data';
export function CustomerSelectedExport({records,admin=false}:{records:{id:string;label:string}[];admin?:boolean}){
 const [selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false);const read=useServerFn(readCustomerSelectedExport),adminRead=useServerFn(readAdminSelectedRequestExport),preview=usePortalPreview();
 const ids=selected.filter(id=>records.some(r=>r.id===id));
 async function download(format:ExportFormat){if(preview.active)return;setBusy(true);try{const rows=admin?await adminRead({data:{ids,format}}):await read({data:{ids,format}});await exportTable(rows,['reference','date','time','timezone_review','pickup','destination','pickup_state','destination_state','pickup_timezone','destination_timezone','pickup_zip','destination_zip','service','status'].map(k=>({label:k.replaceAll('_',' '),value:(r:Record<string,unknown>)=>String(r[k]??'')})),'MY FLORIDA NEMT — Selected Trip Summary',format,'mfn-customer-trip-summary');}catch(e){toast.error(e instanceof Error?e.message:'Report unavailable.');}finally{setBusy(false);}}
 return <section className="space-y-3 border-y border-ds-border py-4"><h2 className="ds-subheading">Selected trip summary</h2><details><summary className="ds-label">Choose trips · {ids.length} selected</summary><div className="max-h-64 overflow-auto space-y-2 mt-3">{records.map(r=><DsCheckbox key={r.id} label={r.label} checked={ids.includes(r.id)} onChange={e=>setSelected(e.target.checked?[...ids,r.id]:ids.filter(id=>id!==r.id))}/>)}{!records.length&&<p className="ds-support">No authorized trips in this view.</p>}</div></details><div className="flex flex-wrap gap-2">{(['csv','xlsx','pdf'] as const).map(f=><DsButton key={f} size="sm" variant="secondary" disabled={!ids.length||busy||preview.active} onClick={()=>download(f)}>Export selected {f.toUpperCase()}</DsButton>)}</div>{preview.active&&<p className="ds-caption">Synthetic selection only — reports are not generated.</p>}</section>;
}