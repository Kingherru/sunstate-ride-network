import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DsCheckbox, DsButton } from '@/components/ds/controls';
import { supabase } from '@/integrations/supabase/client';
import { OverflowText } from './OverflowText';
import { usePortalPreview } from './preview-data';
import { columnWidth, readTableWidths, type TableColumnSizing } from './table-width-rules';

export type RecordColumn<T> = TableColumnSizing & {
  label: string; render: (row: T) => ReactNode; hideable?: boolean; wrap?: boolean;
};
type Props<T> = {
  tableId: string; rows: T[]; columns: RecordColumn<T>[]; rowKey: (row: T) => string;
  onRowClick?: (row: T) => void; rowLabel?: (row: T) => string; empty?: ReactNode;
  mobile?: ReactNode; widths?: Record<string, number>; hidden?: string[];
  onPreferencesChange?: (hidden: string[], widths: Record<string, number>) => void;
};
/** Record-only desktop worksheet with a deliberate stacked layout below desktop. */
export function RecordTable<T>({ tableId, rows, columns, rowKey, onRowClick, rowLabel, empty = 'No records match these filters.', mobile, widths: externalWidths, hidden: externalHidden, onPreferencesChange }: Props<T>) {
  const preview = usePortalPreview();
  const [localWidths, setWidths] = useState<Record<string, number>>({});
  const [localHidden, setHidden] = useState<string[]>([]);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const widths = externalWidths ?? localWidths;
  const hidden = externalHidden ?? localHidden;
  const current = useRef(widths); current.current = widths;
  const columnRef = useRef(columns); columnRef.current = columns;
  useEffect(() => {
    if (preview.active || onPreferencesChange) return;
    let disposed = false;
    const apply = (id?: string) => {
      if (disposed) return;
      const key = id ? `mfn-table-widths:v1:${id}:${tableId}` : null;
      setStorageKey(key); setHidden([]);
      try { setWidths(key ? readTableWidths(localStorage.getItem(key), columnRef.current) : {}); }
      catch { setWidths({}); }
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user.id));
    return () => { disposed = true; data.subscription.unsubscribe(); };
  }, [tableId, preview.active, onPreferencesChange]);
  function persist(h: string[], w: Record<string, number>) {
    if (onPreferencesChange) { onPreferencesChange(h, w); return; }
    if (!preview.active && storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(readTableWidths(JSON.stringify(w), columns))); } catch { /* Storage may be unavailable; resizing still works. */ }
    }
  }
  const visible = columns.filter(c => !c.hideable || !hidden.includes(c.id));
  const sizes = visible.map(c => columnWidth(c, widths[c.id]));
  const content = (column: RecordColumn<T>, row: T) => {
    const value = column.render(row);
    return typeof value === 'string' || typeof value === 'number' ? column.wrap ? <span data-text-wrap>{value}</span> : <OverflowText>{value}</OverflowText> : value;
  };
  function resize(column: RecordColumn<T>, value: number, save: boolean) {
    const next = { ...current.current, [column.id]: columnWidth(column, value) };
    current.current = next; setWidths(next);
    if (save) persist(hidden, next);
  }
  return <div className="portal-record-system min-w-0" data-record-table={tableId}>
    {columns.some(c => c.hideable) && <details className="portal-record-desktop mb-3"><summary className="ds-label cursor-pointer text-ds-primary">Columns</summary><div className="flex flex-wrap gap-4 py-3">{columns.filter(c => c.hideable).map(c => <DsCheckbox key={c.id} label={c.label} checked={!hidden.includes(c.id)} onChange={event => {
      const next = event.target.checked ? hidden.filter(id => id !== c.id) : [...hidden, c.id];
      setHidden(next); persist(next, widths);
    }} />)}</div></details>}
    <div className="portal-record-desktop portal-record-scroll" tabIndex={0} role="region" aria-label={`${tableId.replaceAll('-', ' ')} records`}>
      <table className="portal-record-table text-left" style={{ width: sizes.reduce((sum, size) => sum + size, 0) }}>
        <colgroup>{visible.map((c, index) => <col key={c.id} style={{ width: sizes[index] }} />)}</colgroup>
        <thead><tr>{visible.map(c => <th key={c.id} scope="col" className="ds-label text-ds-primary bg-ds-sky"><OverflowText>{c.label}</OverflowText>
          <span role="separator" tabIndex={0} aria-label={`Resize ${c.label} column`} aria-orientation="vertical" aria-valuemin={c.minWidth ?? 120} aria-valuemax={Math.max(c.minWidth ?? 120, c.maxWidth ?? 520)} aria-valuenow={columnWidth(c, widths[c.id])} className="portal-column-resizer" onClick={event => event.stopPropagation()} onKeyDown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault(); resize(c, columnWidth(c, current.current[c.id]) + (event.key === 'ArrowRight' ? 10 : -10), true);
          }} onPointerDown={event => {
            event.preventDefault(); const target = event.currentTarget; target.setPointerCapture(event.pointerId);
            const start = event.clientX; const initial = columnWidth(c, current.current[c.id]);
            const move = (e: PointerEvent) => resize(c, initial + e.clientX - start, false);
            const end = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end); persist(hidden, current.current); };
            target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
          }} />
        </th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={rowKey(row)} tabIndex={onRowClick ? 0 : undefined} role={onRowClick ? 'button' : undefined} aria-label={rowLabel?.(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} onKeyDown={onRowClick ? event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(row); } } : undefined} className={onRowClick ? 'cursor-pointer hover:bg-ds-hover' : ''}>
          {visible.map(c => <td key={c.id} className="ds-body" data-cell-wrap={c.wrap ? 'true' : undefined}>{content(c, row)}</td>)}
        </tr>)}{rows.length === 0 && <tr><td colSpan={visible.length} data-text-wrap>{empty}</td></tr>}</tbody>
      </table>
    </div>
    <div className="portal-record-mobile">{mobile ?? <ul className="divide-y divide-ds-border">{rows.map(row => <li key={rowKey(row)} className="py-4 min-w-0">
      {onRowClick && <DsButton variant="ghost" onClick={() => onRowClick(row)}>{rowLabel?.(row) ?? 'Open details'}</DsButton>}
      <dl className="grid gap-3">{columns.map(c => <div key={c.id} className="min-w-0"><dt className="ds-label font-bold text-ds-primary">{c.label}</dt><dd className="ds-body mt-1 min-w-0" data-text-wrap>{c.render(row)}</dd></div>)}</dl>
    </li>)}{rows.length === 0 && <li className="py-4 ds-body">{empty}</li>}</ul>}</div>
  </div>;
}