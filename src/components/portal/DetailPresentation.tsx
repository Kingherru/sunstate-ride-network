import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouteContext } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton } from '@/components/ds/controls';
import { getPortalPreferences, savePortalPreferences } from '@/lib/portal-preferences.functions';
import { DEFAULT_COLUMNS, resizeColumns } from '@/lib/portal-read-rules';
import { usePortalPreview, usePortalQuery } from './preview-data';
const Context = createContext(DEFAULT_COLUMNS);
export function DetailPresentation({ children }: { children: React.ReactNode }) {
  const { access } = useRouteContext({ strict: false });
  const preview = usePortalPreview(); const qc = useQueryClient();
  const get = useServerFn(getPortalPreferences); const save = useServerFn(savePortalPreferences);
  const q = usePortalQuery({ queryKey: ['portal-preferences'], queryFn: () => get() });
  const [columns, setColumns] = useState(DEFAULT_COLUMNS); const current = useRef(columns);
  const [variant, setVariant] = useState('rows'); const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data?.detail_columns) setColumns(q.data.detail_columns); }, [q.data]);
  useEffect(() => { current.current = columns; }, [columns]);
  async function persist(next: number[]) {
    setColumns(next); if (preview.active) return;
    setBusy(true); try { await save({ data: { detail_columns: next } }); await qc.invalidateQueries({ queryKey: ['portal-preferences'] }); }
    catch { toast.error('Column preference could not be saved.'); } finally { setBusy(false); }
  }
  return <Context.Provider value={columns}><div data-detail-variant={variant} className="detail-presentation min-w-0">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {access?.isMasterAdmin && <><DsButton size="sm" variant={variant === 'rows' ? 'secondary' : 'ghost'} onClick={() => setVariant('rows')} aria-pressed={variant === 'rows'}>Row dividers</DsButton><DsButton size="sm" variant={variant === 'cells' ? 'secondary' : 'ghost'} onClick={() => setVariant('cells')} aria-pressed={variant === 'cells'}>Cell grouping</DsButton></>}
      <DsButton size="sm" variant="ghost" className="hidden sm:inline-flex" disabled={busy} onClick={() => persist(DEFAULT_COLUMNS)}>Reset columns</DsButton>
    </div>
    <div className="detail-resize-bar hidden sm:flex" aria-label="Detail column sizing">{[0,1,2].map((i) => <div key={i} className="relative min-w-0" style={{ flexBasis: `${columns[i]}%` }}><span className="ds-caption">Column {i + 1} · {columns[i]}%</span>{i < 2 && <div role="separator" tabIndex={0} aria-label={`Resize columns ${i+1} and ${i+2}`} aria-orientation="vertical" aria-valuemin={20} aria-valuemax={60} aria-valuenow={columns[i]} className="detail-resize-handle"
      onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); void persist(resizeColumns(current.current,i,e.key==='ArrowRight'?2:-2)); } }}
      onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const start=e.clientX; const initial=[...current.current]; const width=e.currentTarget.closest('.detail-resize-bar')?.getBoundingClientRect().width ?? 1; const node=e.currentTarget;
        const move=(event:PointerEvent)=>{const next=resizeColumns(initial,i,Math.round((event.clientX-start)/width*100));current.current=next;setColumns(next);};
        const end=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);void persist(current.current);};node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
      }} />}</div>)}</div>{children}</div></Context.Provider>;
}
export function useDetailColumns() { return useContext(Context); }