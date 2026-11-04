import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { DsButton } from "@/components/ds/controls";
import { listEarningsLedger, type LedgerRow } from "@/lib/provider-ops.functions";
import { exportTable, readableDate, type ExportFormat } from "@/lib/table-export";
import { usePortalQuery, usePortalPreview } from "./preview-data";

const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

/** Filtered driver/contractor adjustments and payments; totals come from the server in integer cents. */
export function EarningsLedger() {
  const [f, setF] = useState({ start: monthStart(), end: today(), driverId: "", category: "all" as "all" | "adjustment" | "payment", status: "all" });
  const [format, setFormat] = useState<ExportFormat>("csv"); const [busy, setBusy] = useState(false);
  const valid = f.end >= f.start;
  const preview = usePortalPreview();
  const q = usePortalQuery({ queryKey: ["earnings-ledger", f] as const, enabled: valid, queryFn: () => listEarningsLedger({ data: { ...f, driverId: f.driverId || null } }) });
  const d = q.data as Awaited<ReturnType<typeof listEarningsLedger>> | undefined;
  const statuses = Array.from(new Set((d?.rows ?? []).map((r) => r.status)));
  async function doExport() {
    if (!d) return;
    if (preview.active) { toast("Preview only — no file was created or downloaded."); return; }
    setBusy(true);
    try {
      const who = f.driverId ? d.drivers.find((x) => x.id === f.driverId)?.name ?? "Selected" : "All drivers";
      const title = `Earnings — ${d.workspaceMfn ?? "Workspace"} — generated ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} — ${f.start} to ${f.end} · ${who} · ${f.category} · ${f.status}`;
      await exportTable<LedgerRow>(d.rows, [
        { label: "Date", value: (r) => readableDate(r.date) }, { label: "Driver/contractor", value: (r) => r.driver }, { label: "Type", value: (r) => r.employment },
        { label: "Category", value: (r) => r.category }, { label: "Status", value: (r) => r.status }, { label: "Amount (USD)", value: (r) => (r.amountCents / 100).toFixed(2) }, { label: "Reference", value: (r) => r.reference },
      ], title, format, `earnings-${f.start}-${f.end}`);
    } catch { toast.error("Could not export authorized earnings."); } finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-ds border border-ds-sky-border bg-ds-sky p-4 sm:p-5">
    <h2 className="ds-subheading uppercase text-ds-primary">Earnings records & exports</h2>
    {preview.active && <p role="status" className="ds-label rounded-ds-sm ds-status-blue px-3 py-2 uppercase">Preview mode — demo data. Operational driver earnings only; Network settlements and Membership & Billing are separate.</p>}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <label className="ds-label">From<input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="portal-input mt-1" /></label>
      <label className="ds-label">Through<input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className="portal-input mt-1" /></label>
      <label className="ds-label">Driver/contractor<select value={f.driverId} onChange={(e) => setF({ ...f, driverId: e.target.value })} className="portal-input mt-1"><option value="">All drivers</option>{(d?.drivers ?? []).map((x) => <option key={x.id} value={x.id}>{x.name || "Not provided"}</option>)}</select></label>
      <label className="ds-label">Category<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as typeof f.category })} className="portal-input mt-1"><option value="all">All categories</option><option value="adjustment">Adjustments</option><option value="payment">Payments</option></select></label>
      <label className="ds-label">Status<select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="portal-input mt-1"><option value="all">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
    </div>
    {!valid && <p className="ds-support text-ds-error">End date must follow start date.</p>}
    {q.isError && <p role="alert" className="ds-support text-ds-error">Earnings records are unavailable.</p>}
    {d && <>
      <div className="grid gap-2 sm:grid-cols-3">
        <p className="rounded-ds border border-ds-sky-border bg-ds-surface p-3"><span className="ds-caption block">Records</span><strong>{d.rows.length}</strong></p>
        <p className="rounded-ds border border-ds-sky-border bg-ds-surface p-3"><span className="ds-caption block">Adjustments</span><strong><span className="portal-money">{usd(d.totals.adjustmentsCents)}</span></strong></p>
        <p className="rounded-ds border border-ds-sky-border bg-ds-surface p-3"><span className="ds-caption block">Payments recorded</span><strong><span className="portal-money">{usd(d.totals.paymentsCents)}</span></strong></p>
      </div>
      <div className="overflow-x-auto rounded-ds border border-ds-sky-border bg-ds-surface"><table className="w-full text-sm"><thead><tr className="text-left ds-caption uppercase"><th className="p-2">Date</th><th className="p-2">Driver</th><th className="p-2">Category</th><th className="p-2">Status</th><th className="p-2 text-right">Amount</th></tr></thead>
        <tbody>{d.rows.length === 0 ? <tr><td colSpan={5} className="p-3 ds-support">No records match these filters.</td></tr> : d.rows.map((r) => <tr key={r.id} className="border-t border-ds-border"><td className="p-2 whitespace-nowrap">{readableDate(r.date)}</td><td className="p-2">{r.driver} <span className="ds-caption">· {r.employment}</span></td><td className="p-2 capitalize">{r.category}</td><td className="p-2">{r.status}</td><td className="p-2 text-right"><span className="portal-money">{usd(r.amountCents)}</span></td></tr>)}</tbody></table></div>
      <div className="flex flex-wrap items-end gap-2"><label className="ds-label">Format<select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} className="portal-input mt-1"><option value="csv">CSV</option><option value="xlsx">Excel</option><option value="pdf">PDF</option></select></label>
        <DsButton variant="secondary" disabled={busy || d.rows.length === 0} onClick={doExport} className="whitespace-nowrap"><Download className="size-4" aria-hidden />{busy ? "Exporting…" : "Export results"}</DsButton></div>
    </>}
  </section>;
}
