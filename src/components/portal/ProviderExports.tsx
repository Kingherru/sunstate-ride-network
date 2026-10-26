import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput, DsSelect } from '@/components/ds/controls';
import { listProviderExportRows } from '@/lib/provider-exports.functions';
import { EXPORT_FIELDS, providerCsv } from '@/lib/provider-export-rules';
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
      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf'); const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape' }); doc.text(`MY FLORIDA NEMT — ${kind}`, 14, 16);
        autoTable(doc, { startY: 24, head: [EXPORT_FIELDS.map(k => k.replaceAll('_', ' '))], body: rows.map(r => EXPORT_FIELDS.map(k => String(r[k] ?? ''))), styles: { fontSize: 8 } }); doc.save(`${filename}.pdf`);
      } else {
        const blob = new Blob([providerCsv(rows)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click(); URL.revokeObjectURL(url);
      }
    } catch { toast.error('Could not export authorized trips.'); } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t border-ds-border pt-5"><h2 className="ds-subheading uppercase text-ds-primary">Trip & schedule exports</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <DsField label="Export">{p => <DsSelect {...p} value={kind} onChange={e => setKind(e.target.value)}><option>Trips</option><option>Schedule</option></DsSelect>}</DsField>
      <DsField label="Format">{p => <DsSelect {...p} value={format} onChange={e => setFormat(e.target.value)}><option value="csv">CSV / Excel-compatible CSV</option><option value="pdf">PDF</option></DsSelect>}</DsField>
      <DsField label="From">{p => <DsInput {...p} type="date" value={start} onChange={e => setStart(e.target.value)} />}</DsField>
      <DsField label="Through">{p => <DsInput {...p} type="date" value={end} onChange={e => setEnd(e.target.value)} />}</DsField>
    </div><DsButton size="sm" disabled={busy || end < start} onClick={download}><Download className="size-4" aria-hidden />{busy ? 'Preparing…' : 'Download'}</DsButton>
  </section>;
}