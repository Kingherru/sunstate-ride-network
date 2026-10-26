import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";
import { DsButton } from "@/components/ds/controls";
import { previewScheduleEmails } from "@/lib/schedule-email-preview.functions";
import { usePortalPreview, usePortalQuery } from "@/components/portal/preview-data";
import { listMyDrivers } from "@/lib/schedule-board.functions";

export function ScheduleEmailPreview() {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(start);
  const [range, setRange] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof previewScheduleEmails>> | null>(null);
  const [audit, setAudit] = useState<string[]>([]);
  const preview = usePortalPreview();
  const prepare = useServerFn(previewScheduleEmails);
  const drivers = usePortalQuery({ queryKey: ["my-drivers"], queryFn: () => listMyDrivers() });
  async function review() {
    setBusy(true);
    try {
      if (preview.active) setResult({ safeMode: true, start, end: range ? end : start, recipients: (drivers.data ?? []).filter((d) => all || ids.includes(d.id)).map((d) => ({ id: d.id, name: `${d.first_name} ${d.last_name}`, email: null, trips: [] })) });
      else setResult(await prepare({ data: { driverIds: ids, allDrivers: all, start, end: range ? end : start } }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not prepare schedules."); }
    finally { setBusy(false); }
  }
  return <div className="mb-5"><DsButton variant="secondary" onClick={() => { setOpen(true); setResult(null); }}><Mail className="size-4" aria-hidden />Email trips to drivers</DsButton>
    {open && <section aria-label="Driver schedule email preview" className="mt-3 rounded-ds border border-ds-sky-border bg-ds-sky p-4 space-y-4">
      <div className="flex justify-between items-center gap-3"><h3 className="ds-subheading text-ds-primary">Email trips to drivers — Safe mode</h3><DsButton aria-label="Close email preview" variant="ghost" onClick={() => setOpen(false)}><X className="size-4" /></DsButton></div>
      <div className="portal-toolbar"><label className="ds-label">Date<input aria-label="Schedule email start date" type="date" value={start} onChange={(e) => { setStart(e.target.value); setResult(null); }} className="portal-input" /></label><label className="flex items-center gap-2"><input type="checkbox" checked={range} onChange={(e) => { setRange(e.target.checked); setResult(null); }} />Date range</label>{range && <label className="ds-label">Through<input aria-label="Schedule email end date" type="date" value={end} onChange={(e) => { setEnd(e.target.value); setResult(null); }} className="portal-input" /></label>}</div>
      <label className="flex gap-2 items-center"><input type="checkbox" checked={all} onChange={(e) => { setAll(e.target.checked); setResult(null); }} />All Drivers</label>
      <div className="flex flex-wrap gap-4">{(drivers.data ?? []).map((d) => <label key={d.id} className="flex gap-2 items-center"><input type="checkbox" checked={all || ids.includes(d.id)} disabled={all} onChange={(e) => { setIds((v) => e.target.checked ? [...v, d.id] : v.filter((id) => id !== d.id)); setResult(null); }} />{d.first_name} {d.last_name}</label>)}</div>
      {(drivers.data ?? []).length === 0 && <p className="ds-support">No authorized drivers available.</p>}
      <DsButton disabled={busy || (!all && ids.length === 0) || (range && end < start)} onClick={review}>{busy ? "Preparing…" : "Review schedules"}</DsButton>
      {result && <div className="space-y-3"><p className="ds-label">{result.recipients.length} recipients · {result.start} — {result.end} · No emails will be sent</p>{result.recipients.map((r) => <div key={r.id} className="border border-ds-border bg-ds-surface p-3 rounded-ds"><h4 className="ds-label">{r.name} · {r.email ?? "No email on file"}</h4>{r.trips.length === 0 ? <p className="ds-support">No assigned trips in this period.</p> : r.trips.map((t) => <p className="ds-body" key={t.reference}>{t.date} {t.time} · {t.reference} · {t.pickup} → {t.destination}</p>)}</div>)}<DsButton onClick={() => { setAudit((a) => [`${new Date().toISOString()} · Preview confirmed · ${result.recipients.length} drivers · ${result.start} — ${result.end} · Sent: 0`, ...a]); setResult(null); toast.success("Safe-mode preview confirmed. No emails sent."); }}>Confirm preview only</DsButton></div>}
      {audit.length > 0 && <div><h4 className="ds-label">Safe-mode audit — this session</h4>{audit.map((line, i) => <p key={i} className="ds-caption mt-1">{line}</p>)}</div>}
    </section>}
  </div>;
}