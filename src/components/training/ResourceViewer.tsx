import {useEffect,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {downloadPurchasedGuide} from '@/lib/guide-download.functions';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {DsButton} from '@/components/ds/controls';
import {exportTable} from '@/lib/table-export';
export function ResourceViewer({preview=false,onClose}:{preview?:boolean;onClose:()=>void}){
 const open=useServerFn(downloadPurchasedGuide),[url,setUrl]=useState(''),[error,setError]=useState(''),[allowed,setAllowed]=useState(false);
 useEffect(()=>{if(preview)return;let active=true;open({data:{action:'open'}}).then(r=>{if(!active)return;if('url'in r&&r.url){setUrl(r.url);setAllowed(!!r.downloadAllowed);}else setError(r.error??'Resource unavailable.');}).catch(()=>setError('Resource unavailable.')).finally(()=>{});return()=>{active=false;};},[preview]);
 async function download(){const r=await open({data:{action:'download'}});if('url'in r&&r.url)window.open(r.url,'_blank','noopener,noreferrer');else setError(r.error??'Download unavailable.');}
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="theme-portal !max-w-5xl"><DialogTitle>Purchased resource</DialogTitle>{preview?<div className="min-h-80 bg-ds-surface-muted p-6"><h2 className="ds-subheading text-ds-primary">SYNTHETIC SAMPLE — NOT THE PURCHASED GUIDE</h2><p className="ds-body mt-4">Sample resource preview. No purchase entitlement or real file is requested.</p></div>:error?<p role="alert" className="ds-status-yellow p-4">{error}</p>:url?<iframe title="Purchased PDF document" src={url} className="h-[65dvh] w-full border-0"/>:<p role="status">Verifying purchase…</p>}<DsButton disabled={preview||!allowed} onClick={download}>Download PDF</DsButton>{!allowed&&<p className="ds-support">Downloads require verified purchase evidence and an approved download policy.</p>}</DialogContent></Dialog>;
}