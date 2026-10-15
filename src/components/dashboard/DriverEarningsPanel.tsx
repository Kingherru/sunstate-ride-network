import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listDrivers } from "@/lib/fleet.functions";
import {
  getDriverEarnings,
  upsertDriverAdjustment,
  deleteDriverAdjustment,
  upsertDriverPayment,
  deleteDriverPayment,
  listDriverPaymentHistory,
  sendDriverEarningsReport,
  listDriverEarningsReports,
} from "@/lib/driver-earnings.functions";
import {
  downloadDriverEarningsPdf,
  driverEarningsPdfBlobUrl,
  type DriverEarningsPdfInput,
} from "@/lib/driver-earnings-pdf";

type Preset = "this_week" | "last_week" | "this_month" | "last_month" | "pay_period" | "custom";

function isoDay(d: Date): string { return d.toISOString().slice(0, 10); }
function usd(cents: number | null | undefined): string {
  const n = Number(cents ?? 0) / 100;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function dollarsToCents(s: string): number {
  const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function centsToDollars(c?: number | null): string {
  if (c == null) return "";
  return (c / 100).toFixed(2);
}

function rangeFor(preset: Preset, custom: { start: string; end: string }): { start: string; end: string } {
  const now = new Date();
  if (preset === "custom") return custom;
  if (preset === "this_week" || preset === "last_week") {
    const d = new Date(now); const day = d.getDay(); // Sun=0
    const diffToMon = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMon);
    if (preset === "last_week") d.setDate(d.getDate() - 7);
    const end = new Date(d); end.setDate(end.getDate() + 6);
    return { start: isoDay(d), end: isoDay(end) };
  }
  if (preset === "this_month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: isoDay(s), end: isoDay(e) };
  }
  if (preset === "last_month") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: isoDay(s), end: isoDay(e) };
  }
  // pay_period: biweekly pay period ending most recent Friday
  const d = new Date(now); const day = d.getDay();
  const daysBackToFri = (day + 2) % 7; // Fri=5 → 0
  d.setDate(d.getDate() - daysBackToFri);
  const start = new Date(d); start.setDate(d.getDate() - 13);
  return { start: isoDay(start), end: isoDay(d) };
}

export function DriverEarningsPanel() {
  const qc = useQueryClient();
  const driversQ = useQuery({ queryKey: ["drivers"], queryFn: () => listDrivers() });
  const drivers = (driversQ.data ?? []) as any[];
  const [driverId, setDriverId] = useState<string>("");
  const [preset, setPreset] = useState<Preset>("this_month");
  const [custom, setCustom] = useState<{ start: string; end: string }>(() => {
    const r = rangeFor("this_month", { start: "", end: "" });
    return r;
  });
  const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);

  // Auto-pick first driver when loaded
  const effectiveDriverId = driverId || drivers[0]?.id || "";

  const report = useQuery({
    enabled: !!effectiveDriverId,
    queryKey: ["driver-earnings", effectiveDriverId, range.start, range.end],
    queryFn: () => getDriverEarnings({ data: { driver_id: effectiveDriverId, start: range.start, end: range.end } }),
  });

  const history = useQuery({
    enabled: !!effectiveDriverId,
    queryKey: ["driver-payment-history", effectiveDriverId],
    queryFn: () => listDriverPaymentHistory({ data: { driver_id: effectiveDriverId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["driver-earnings", effectiveDriverId] });
    qc.invalidateQueries({ queryKey: ["driver-payment-history", effectiveDriverId] });
  };

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Driver earnings & payment history</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically calculates gross pay from completed trips based on each driver's selected pay structure.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Driver</span>
            <select value={effectiveDriverId} onChange={(e) => setDriverId(e.target.value)}
                    className="border border-border rounded-sm px-3 py-2 bg-background">
              {drivers.length === 0 && <option value="">No drivers</option>}
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.first_name} {d.last_name}{d.pay_type ? ` · ${d.pay_type.replace("_", " ")}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Range</span>
            <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}
                    className="border border-border rounded-sm px-3 py-2 bg-background">
              <option value="this_week">This week</option>
              <option value="last_week">Last week</option>
              <option value="pay_period">Current pay period (biweekly)</option>
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Start</span>
            <input type="date" value={preset === "custom" ? custom.start : range.start}
                   disabled={preset !== "custom"}
                   onChange={(e) => setCustom({ ...custom, start: e.target.value })}
                   className="border border-border rounded-sm px-3 py-2 bg-background disabled:opacity-60" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">End</span>
            <input type="date" value={preset === "custom" ? custom.end : range.end}
                   disabled={preset !== "custom"}
                   onChange={(e) => setCustom({ ...custom, end: e.target.value })}
                   className="border border-border rounded-sm px-3 py-2 bg-background disabled:opacity-60" />
          </label>
        </div>
      </section>

      {!effectiveDriverId && (
        <p className="text-sm text-muted-foreground">Add a driver in Drivers & Vehicles to start tracking earnings.</p>
      )}

      {effectiveDriverId && report.isLoading && <p className="text-sm text-muted-foreground">Calculating…</p>}
      {report.isError && <p className="text-sm text-destructive">{(report.error as any)?.message ?? "Failed to load"}</p>}

      {report.data && (
        <>
          <section className="grid md:grid-cols-4 gap-3">
            <SummaryCell label="Completed trips" value={String(report.data.trips.completed_count)} />
            <SummaryCell label="Pickup legs" value={String(report.data.trips.pickup_legs)} />
            <SummaryCell label="Miles" value={report.data.trips.total_miles.toFixed(1)} />
            <SummaryCell label="Wait minutes" value={String(report.data.trips.wait_minutes)} />
            <SummaryCell label="Cancellations" value={String(report.data.trips.canceled_count)} />
            <SummaryCell label="Hours worked" value={report.data.trips.worked_hours.toFixed(2)} />
            <SummaryCell label="Days worked" value={String(report.data.trips.worked_days)} />
            <SummaryCell label="Pay structure"
              value={report.data.pay_type ? report.data.pay_type.replace(/_/g, " ") : "not set"} />
          </section>

          <section className="grid md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-sm p-5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">Gross earnings</div>
              {report.data.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No earnings in this range. Set a pay structure and rates on the driver to enable calculation.
                </p>
              ) : (
                <ul className="text-sm divide-y divide-border">
                  {report.data.lines.map((l, i) => (
                    <li key={i} className="py-1.5 flex items-center justify-between">
                      <span>{l.label}</span><span className="font-bold">{usd(l.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-border mt-3 pt-3 space-y-1 text-sm">
                <Line label="Gross" v={usd(report.data.gross_cents)} bold />
                <Line label="Adjustments" v={usd(report.data.adjustments_cents)} />
                <Line label="Amount paid" v={`− ${usd(report.data.amount_paid_cents)}`} />
                <Line label="Outstanding balance"
                      v={usd(report.data.outstanding_cents)} bold accent />
              </div>
            </div>

            <AdjustmentsCard
              driverId={effectiveDriverId}
              adjustments={report.data.adjustments}
              onChanged={invalidate}
            />
          </section>

          <PaymentsCard
            driverId={effectiveDriverId}
            range={range}
            grossCents={report.data.gross_cents + report.data.adjustments_cents}
            payments={report.data.payments}
            onChanged={invalidate}
          />

          <EmailReportCard
            driver={drivers.find((d) => d.id === effectiveDriverId)}
            range={range}
            report={report.data}
            onSent={() => {
              qc.invalidateQueries({ queryKey: ["driver-earnings-reports", effectiveDriverId] });
            }}
          />

          <EmailedReportsHistoryCard driverId={effectiveDriverId} />

          <PaymentHistoryCard
            payments={history.data ?? []}
            loading={history.isLoading}
            onChanged={invalidate}
          />
        </>
      )}
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-sm px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold tracking-tight mt-1 text-brand">{value}</div>
    </div>
  );
}
function Line({ label, v, bold, accent }: { label: string; v: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-bold" : ""} ${accent ? "text-accent" : ""}`}>
      <span>{label}</span><span>{v}</span>
    </div>
  );
}

/* -------- Adjustments -------- */
function AdjustmentsCard({ driverId, adjustments, onChanged }: { driverId: string; adjustments: any[]; onChanged: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [applied, setApplied] = useState(isoDay(new Date()));
  const upsert = useMutation({
    mutationFn: () => upsertDriverAdjustment({ data: {
      driver_id: driverId, applied_on: applied,
      amount_cents: dollarsToCents(amount), reason: reason || null,
    } }),
    onSuccess: () => { toast.success("Adjustment added"); setAmount(""); setReason(""); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteDriverAdjustment({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); onChanged(); },
  });
  return (
    <div className="bg-card border border-border rounded-sm p-5">
      <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">Adjustments in range</div>
      {(adjustments ?? []).length === 0 && <p className="text-sm text-muted-foreground mb-3">No adjustments in this range.</p>}
      <ul className="text-sm divide-y divide-border mb-3">
        {adjustments.map((a) => (
          <li key={a.id} className="py-1.5 flex items-center justify-between">
            <span>
              <span className="font-mono text-xs text-muted-foreground mr-2">{a.applied_on}</span>
              {a.reason || <span className="italic text-muted-foreground">no reason</span>}
            </span>
            <span className="flex items-center gap-3">
              <span className={`font-bold ${a.amount_cents < 0 ? "text-destructive" : ""}`}>{usd(a.amount_cents)}</span>
              <button onClick={() => confirm("Remove adjustment?") && del.mutate(a.id)}
                      className="text-xs font-bold text-red-600 hover:underline">Remove</button>
            </span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col gap-1"><span className="font-bold">Date</span>
          <input type="date" value={applied} onChange={(e) => setApplied(e.target.value)}
                 className="border border-border rounded-sm px-2 py-1 bg-background" /></label>
        <label className="flex flex-col gap-1"><span className="font-bold">Amount ($)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00 or -10.00"
                 className="border border-border rounded-sm px-2 py-1 bg-background" /></label>
        <label className="flex flex-col gap-1"><span className="font-bold">Reason</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bonus / deduction"
                 className="border border-border rounded-sm px-2 py-1 bg-background" /></label>
      </div>
      <div className="flex justify-end mt-2">
        <button disabled={upsert.isPending || !amount} onClick={() => upsert.mutate()}
                className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm text-xs disabled:opacity-50">
          {upsert.isPending ? "Saving…" : "Add adjustment"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Use negative amounts for deductions or write-offs.</p>
    </div>
  );
}

/* -------- Payments (record + mark paid/partial/unpaid) -------- */
function PaymentsCard({ driverId, range, grossCents, payments, onChanged }:
  { driverId: string; range: { start: string; end: string }; grossCents: number; payments: any[]; onChanged: () => void }) {
  const [amount, setAmount] = useState(centsToDollars(grossCents));
  const [status, setStatus] = useState<"paid" | "partial" | "unpaid">("paid");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const upsert = useMutation({
    mutationFn: () => upsertDriverPayment({ data: {
      driver_id: driverId,
      period_start: range.start, period_end: range.end,
      gross_cents: grossCents,
      amount_paid_cents: dollarsToCents(amount),
      status, method: method || null, notes: notes || null,
    } }),
    onSuccess: () => { toast.success("Payment recorded"); setAmount(""); setNotes(""); setMethod(""); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteDriverPayment({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); onChanged(); },
  });
  const updateStatus = useMutation({
    mutationFn: (p: { id: string; status: "paid" | "partial" | "unpaid" }) =>
      upsertDriverPayment({ data: { id: p.id, driver_id: driverId, status: p.status } }),
    onSuccess: () => { toast.success("Updated"); onChanged(); },
  });
  return (
    <section className="bg-card border border-border rounded-sm p-5">
      <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">Payments for this range</div>
      {(payments ?? []).length === 0 && <p className="text-sm text-muted-foreground mb-3">No payments recorded for this range yet.</p>}
      <ul className="text-sm divide-y divide-border mb-4">
        {payments.map((p) => (
          <li key={p.id} className="py-2 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold">
                {usd(p.amount_paid_cents)}
                <span className="ml-2 text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-muted text-muted-foreground">
                  {p.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {p.period_start && p.period_end ? `${p.period_start} → ${p.period_end}` : "Ad-hoc"}
                {p.method ? ` · ${p.method}` : ""}{p.reference ? ` · ${p.reference}` : ""}
              </div>
              {p.notes && <div className="text-xs mt-1">{p.notes}</div>}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <select value={p.status} onChange={(e) => updateStatus.mutate({ id: p.id, status: e.target.value as any })}
                      className="border border-border rounded-sm px-2 py-1 bg-background">
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <button onClick={() => confirm("Delete payment?") && del.mutate(p.id)}
                      className="font-bold text-red-600 hover:underline">Delete</button>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid md:grid-cols-4 gap-2 text-xs">
        <label className="flex flex-col gap-1"><span className="font-bold">Amount ($)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)}
                 placeholder={centsToDollars(grossCents)}
                 className="border border-border rounded-sm px-2 py-1 bg-background" /></label>
        <label className="flex flex-col gap-1"><span className="font-bold">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)}
                  className="border border-border rounded-sm px-2 py-1 bg-background">
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select></label>
        <label className="flex flex-col gap-1"><span className="font-bold">Method</span>
          <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Check, ACH, Zelle…"
                 className="border border-border rounded-sm px-2 py-1 bg-background" /></label>
        <label className="flex flex-col gap-1"><span className="font-bold">Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
                 className="border border-border rounded-sm px-2 py-1 bg-background" /></label>
      </div>
      <div className="flex justify-end mt-3">
        <button disabled={upsert.isPending} onClick={() => upsert.mutate()}
                className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm text-xs disabled:opacity-50">
          {upsert.isPending ? "Saving…" : "Record payment"}
        </button>
      </div>
    </section>
  );
}

/* -------- Full payment history for the selected driver -------- */
function PaymentHistoryCard({ payments, loading, onChanged }:
  { payments: any[]; loading: boolean; onChanged: () => void }) {
  const del = useMutation({
    mutationFn: (id: string) => deleteDriverPayment({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); onChanged(); },
  });
  return (
    <section className="bg-card border border-border rounded-sm p-5">
      <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">
        Full payment history
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left py-1">Period</th><th className="text-left">Status</th>
                <th className="text-right">Gross</th><th className="text-right">Paid</th>
                <th className="text-left pl-3">Method</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5">{p.period_start && p.period_end ? `${p.period_start} → ${p.period_end}` : "—"}</td>
                  <td className="uppercase text-xs">{p.status}</td>
                  <td className="text-right">{usd(p.gross_cents)}</td>
                  <td className="text-right font-bold">{usd(p.amount_paid_cents)}</td>
                  <td className="pl-3">{p.method ?? "—"}</td>
                  <td className="text-right">
                    <button onClick={() => confirm("Delete payment?") && del.mutate(p.id)}
                            className="text-xs font-bold text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </section>
  );
}

/* -------- Email earnings report (preview + send) -------- */
function EmailReportCard({
  driver, range, report, onSent,
}: {
  driver: any;
  range: { start: string; end: string };
  report: any;
  onSent: () => void;
}) {
  const [recipient, setRecipient] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setRecipient(driver?.email || "");
  }, [driver?.id, driver?.email]);

  const periodLabel = `${range.start} → ${range.end}`;
  const driverName = driver ? `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim() || "Driver" : "Driver";

  const pdfInput = useMemo<DriverEarningsPdfInput | null>(() => {
    if (!report) return null;
    return {
      driverName,
      driverEmail: recipient || driver?.email || null,
      periodLabel,
      senderNote: note || null,
      trips: report.trips,
      lines: report.lines,
      gross_cents: report.gross_cents,
      adjustments_cents: report.adjustments_cents,
      amount_paid_cents: report.amount_paid_cents,
      outstanding_cents: report.outstanding_cents,
    };
  }, [report, recipient, note, periodLabel, driverName, driver?.email]);

  const openPreview = () => {
    if (!pdfInput) return;
    const url = driverEarningsPdfBlobUrl(pdfInput);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };
  const closePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const send = useMutation({
    mutationFn: () => sendDriverEarningsReport({ data: {
      driver_id: driver.id,
      period_start: range.start,
      period_end: range.end,
      period_label: periodLabel,
      recipient_email: recipient.trim(),
      sender_note: note.trim() || null,
    } }),
    onSuccess: () => {
      toast.success(`Emailed earnings statement to ${recipient}`);
      setNote("");
      onSent();
      closePreview();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  const canSend = !!driver && !!report && /.+@.+\..+/.test(recipient);

  return (
    <section className="bg-card border border-border rounded-sm p-5">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Email earnings report to driver
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Preview a PDF statement for {periodLabel} and email it directly to the driver.
          </p>
        </div>
        <button
          onClick={() => pdfInput && downloadDriverEarningsPdf(pdfInput,
            `earnings-${driverName.replace(/\s+/g, "-")}-${range.start}-to-${range.end}.pdf`)}
          disabled={!pdfInput}
          className="text-xs font-bold border border-border px-3 py-1.5 rounded-sm hover:bg-muted disabled:opacity-50"
        >
          Download PDF
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="font-bold">Driver email</span>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="driver@example.com"
            className="border border-border rounded-sm px-2 py-1.5 bg-background"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Optional note (included in email + PDF)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Great work this pay period — check attached statement."
            className="border border-border rounded-sm px-2 py-1.5 bg-background"
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={openPreview}
          disabled={!pdfInput}
          className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted disabled:opacity-50"
        >
          Preview PDF
        </button>
        <button
          onClick={() => send.mutate()}
          disabled={!canSend || send.isPending}
          className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm text-xs disabled:opacity-50"
        >
          {send.isPending ? "Sending…" : "Email report to driver"}
        </button>
      </div>

      {previewOpen && previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
             onClick={closePreview}>
          <div className="bg-card border border-border rounded-sm w-full max-w-4xl h-[85vh] flex flex-col"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-border">
              <div className="text-sm font-bold">PDF preview — {driverName} · {periodLabel}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => send.mutate()}
                  disabled={!canSend || send.isPending}
                  className="bg-primary text-primary-foreground font-bold px-3 py-1.5 rounded-sm text-xs disabled:opacity-50"
                >
                  {send.isPending ? "Sending…" : `Send to ${recipient || "driver"}`}
                </button>
                <button onClick={closePreview}
                        className="text-xs font-bold border border-border px-3 py-1.5 rounded-sm hover:bg-muted">
                  Close
                </button>
              </div>
            </div>
            <iframe title="Earnings PDF preview" src={previewUrl} className="flex-1 w-full bg-white" />
          </div>
        </div>
      )}
    </section>
  );
}

/* -------- Emailed reports history -------- */
function EmailedReportsHistoryCard({ driverId }: { driverId: string }) {
  const q = useQuery({
    enabled: !!driverId,
    queryKey: ["driver-earnings-reports", driverId],
    queryFn: () => listDriverEarningsReports({ data: { driver_id: driverId } }),
  });
  const reports = (q.data ?? []) as any[];

  const openSnapshot = (r: any) => {
    const snap = r.snapshot || {};
    const trips = snap.trips || {};
    const input: DriverEarningsPdfInput = {
      driverName: "Driver",
      driverEmail: r.recipient_email,
      periodLabel: snap.period_label || `${r.period_start} → ${r.period_end}`,
      senderNote: r.notes || null,
      trips: {
        completed_count: trips.completed_count ?? 0,
        canceled_count: trips.canceled_count ?? 0,
        total_miles: trips.total_miles ?? 0,
        pickup_legs: trips.pickup_legs ?? 0,
        wait_minutes: trips.wait_minutes ?? 0,
        worked_hours: trips.worked_hours ?? 0,
        worked_days: trips.worked_days ?? 0,
      },
      lines: snap.lines ?? [],
      gross_cents: snap.gross_cents ?? 0,
      adjustments_cents: snap.adjustments_cents ?? 0,
      amount_paid_cents: snap.amount_paid_cents ?? 0,
      outstanding_cents: snap.outstanding_cents ?? 0,
    };
    downloadDriverEarningsPdf(input, `earnings-${r.period_start}-to-${r.period_end}.pdf`);
  };

  return (
    <section className="bg-card border border-border rounded-sm p-5">
      <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">
        Emailed earnings reports
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No earnings reports have been emailed to this driver yet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left py-1">Sent</th>
              <th className="text-left">Period</th>
              <th className="text-left">Recipient</th>
              <th className="text-right">Gross</th>
              <th className="text-right">Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {reports.map((r) => (
              <tr key={r.id}>
                <td className="py-1.5">{new Date(r.sent_at).toLocaleString()}</td>
                <td>{r.period_start} → {r.period_end}</td>
                <td>{r.recipient_email}</td>
                <td className="text-right">{usd(r.snapshot?.gross_cents ?? 0)}</td>
                <td className="text-right font-bold">{usd(r.snapshot?.outstanding_cents ?? 0)}</td>
                <td className="text-right">
                  <button onClick={() => openSnapshot(r)}
                          className="text-xs font-bold text-primary hover:underline">
                    Re-download PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
