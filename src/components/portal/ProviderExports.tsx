import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput, DsSelect } from '@/components/ds/controls';
import { listProviderExportRows } from '@/lib/provider-exports.functions';
import { EXPORT_FIELDS } from '@/lib/provider-export-rules';
import { exportTable, readableDate, type ExportFormat } from '@/lib/table-export';
import { usePortalPreview, previewBlocked } from './preview-data';

export function ProviderExports() {
  const preview = usePortalPreview(); const read = useServerFn(listProviderExportRows);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10)); const [end, setEnd] = useState(start);
  const [format, setFormat] = useState('csv'); const [kind, setKind] = useState('Trips'); const [busy, setBusy] = useState(false);
  async function download() {
    if (preview.active) { previewBlocked(); return; }
    setBusy(true);
    try {
      const rows = await read({ data: { start, end } });
      if (!rows.length) { toast('No authorized trips in this date range.'); return; }
      const filename = `${kind.toLowerCase()}-${start}-${end}`;
      const cols = EXPORT_FIELDS.map((k) => ({ label: k.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()), value: (r: any) => k === 'pickup_date' ? readableDate(r[k]) : r[k] }));
      await exportTable(rows as any[], cols, kind, format as ExportFormat, filename);
    } catch { toast.error('Could not export authorized trips.'); } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t border-ds-border pt-5"><h2 className="ds-subheading uppercase text-ds-primary">Trip & schedule exports</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <DsField label="Export">{p => <DsSelect {...p} value={kind} onChange={e => setKind(e.target.value)}><option>Trips</option><option>Schedule</option></DsSelect>}</DsField>
      <DsField label="Format">{p => <DsSelect {...p} value={format} onChange={e => setFormat(e.target.value)}><option value="csv">CSV</option><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF</option></DsSelect>}</DsField>
      <DsField label="From">{p => <DsInput {...p} type="date" value={start} onChange={e => setStart(e.target.value)} />}</DsField>
      <DsField label="Through">{p => <DsInput {...p} type="date" value={end} onChange={e => setEnd(e.target.value)} />}</DsField>
    </div><DsButton size="sm" disabled={busy || end < start} onClick={download}><Download className="size-4" aria-hidden />{busy ? 'Preparing…' : 'Download'}</DsButton>
  </section>;
}