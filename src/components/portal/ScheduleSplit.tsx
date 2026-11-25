import {useRef,useState,type ReactNode} from 'react';
/** Percent-only layout state: never stores trips or identities. */
export function ScheduleSplit({left,right}:{left:ReactNode;right:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(50);
 function move(x:number){const r=ref.current?.getBoundingClientRect();if(r)setWidth(Math.max(30,Math.min(70,(x-r.left)/r.width*100)));}
 return <div ref={ref} className={`schedule-split split-${Math.round(width/5)*5}`}><div className="min-w-0">{left}</div><div role="separator" aria-label="Resize daily schedules" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={Math.round(width)} tabIndex={0} className="schedule-divider" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e.clientX);}} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setWidth(v=>Math.max(30,Math.min(70,v+(e.key==='ArrowRight'?5:-5))));}if(e.key==='Home')setWidth(30);if(e.key==='End')setWidth(70);}}><span aria-hidden="true">⋮</span></div><div className="min-w-0">{right}</div></div>;
}
