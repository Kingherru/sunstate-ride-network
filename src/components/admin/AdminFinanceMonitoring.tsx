import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getFinCronStatus,
  adminRunFinCron,
  listAdminFinActions,
  adminFeeAdjust,
} from "@/lib/finance/finance.functions";
import { formatCents } from "@/lib/finance/constants";

type CronStatus = {
  job_name: string;
  last_run_at: string | null;
  last_ended_at: string | null;
  last_ok: boolean | null;
  last_processed: number | null;
  last_failed: number | null;
  last_error: string | null;
  last_triggered_by: string | null;
  last_success_at: string | null;
  errors_24h: number | null;
};

const JOB_LABEL: Record<string, string> = {
  "fin-release-tick": "Release to balance",
  "fin-cashout-tick": "Provider cash-outs",
};

function fmtTs(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString() : "—";
}
function since(v: string | null | undefined) {
  if (!v) return "never";
  const diff = Math.max(0, Date.now() - new Date(v).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

/**
 * Admin finance monitoring: cron heartbeat, error counts, manual re-run,
 * audit trail of admin actions, and a fee-adjustment form.
 */
export function AdminFinanceMonitoring() {
  const qc = useQueryClient();
  const cronQ = useQuery({
    queryKey: ["fin-cron-status"],
    queryFn: () => getFinCronStatus(),
    refetchInterval: 30_000,
  });
  const auditQ = useQuery({
    queryKey: ["fin-admin-actions"],
    queryFn: () => listAdminFinActions({ data: { limit: 50 } }),
    refetchInterval: 60_000,
  });
  const runFn = useServerFn(adminRunFinCron);
  const feeFn = useServerFn(adminFeeAdjust);
  const [busy, setBusy] = useState<string | null>(null);

  const [feeTripId, setFeeTripId] = useState("");
  const [feePlatform, setFeePlatform] = useState("");
  const [feeReferral, setFeeReferral] = useState("");
  const [feeReason, setFeeReason] = useState("");
  const [feeBusy, setFeeBusy] = useState(false);

  async function rerun(job: "fin-release-tick" | "fin-cashout-tick") {
    setBusy(job);
    try {
      await runFn({ data: { job } });
      toast.success(`${JOB_LABEL[job]} triggered`);
      await qc.invalidateQueries({ queryKey: ["fin-cron-status"] });
      await qc.invalidateQueries({ queryKey: ["admin-fin-ledger"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally { setBusy(null); }
  }

  async function submitFeeAdjust(e: React.FormEvent) {
    e.preventDefault();
    const payload: { trip_id: string; reason: string; new_platform_cents?: number; new_referral_cents?: number } = {
      trip_id: feeTripId.trim(),
      reason: feeReason.trim(),
    };
    const p = Number(feePlatform); const r = Number(feeReferral);
    if (feePlatform !== "" && Number.isFinite(p)) payload.new_platform_cents = Math.round(p * 100);
    if (feeReferral !== "" && Number.isFinite(r)) payload.new_referral_cents = Math.round(r * 100);
    if (!payload.trip_id) return toast.error("Trip ID required");
    if (payload.reason.length < 3) return toast.error("Reason required");
    if (payload.new_platform_cents === undefined && payload.new_referral_cents === undefined) {
      return toast.error("Provide a new platform or referral amount");
    }
    setFeeBusy(true);
    try {
      await feeFn({ data: payload });
      toast.success("Fee adjusted; audit entry created");
      setFeeTripId(""); setFeePlatform(""); setFeeReferral(""); setFeeReason("");
      await qc.invalidateQueries({ queryKey: ["fin-admin-actions"] });
      await qc.invalidateQueries({ queryKey: ["admin-fin-ledger"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed");
    } finally { setFeeBusy(false); }
  }

  const status = (cronQ.data?.status ?? []) as CronStatus[];
  const jobsShown = ["fin-release-tick", "fin-cashout-tick"];

  return (
    <section className="space-y-6">
      <header>
        <h3 className="font-display text-xl font-extrabold tracking-tight">Cron health</h3>
        <p className="text-xs text-muted-foreground">Release-to-balance runs every 15 min. Cash-outs every 5 min.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {jobsShown.map((job) => {
          const s = status.find((x) => x.job_name === job);
          const healthy = s?.last_ok && (s?.errors_24h ?? 0) === 0;
          return (
            <div key={job} className="border border-border rounded-sm p-4 bg-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase text-muted-foreground">{JOB_LABEL[job]}</div>
                  <div className="text-lg font-black">{s ? (healthy ? "Healthy" : "Attention") : "No runs yet"}</div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${
                  !s ? "bg-muted text-muted-foreground" : healthy ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}>
                  {s ? (healthy ? "OK" : `${s.errors_24h ?? 0} errors/24h`) : "IDLE"}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Last run</dt>
                <dd className="tabular-nums text-right">{since(s?.last_run_at)}</dd>
                <dt className="text-muted-foreground">Last success</dt>
                <dd className="tabular-nums text-right">{since(s?.last_success_at)}</dd>
                <dt className="text-muted-foreground">Processed</dt>
                <dd className="tabular-nums text-right">{s?.last_processed ?? 0}</dd>
                <dt className="text-muted-foreground">Failed</dt>
                <dd className="tabular-nums text-right">{s?.last_failed ?? 0}</dd>
              </dl>
              {s?.last_error && (
                <p className="mt-2 text-[11px] text-destructive break-words">{s.last_error}</p>
              )}
              <button type="button" disabled={busy === job}
                onClick={() => rerun(job as "fin-release-tick" | "fin-cashout-tick")}
                className="mt-3 text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm bg-primary text-primary-foreground disabled:opacity-50">
                {busy === job ? "Running…" : "Run now"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="border border-border rounded-sm bg-card">
        <div className="px-4 py-2 text-xs font-bold uppercase border-b border-border">Recent runs</div>
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-1">Job</th>
              <th className="text-left px-3 py-1">Started</th>
              <th className="text-left px-3 py-1">Result</th>
              <th className="text-right px-3 py-1">Processed</th>
              <th className="text-right px-3 py-1">Failed</th>
              <th className="text-left px-3 py-1">Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(cronQ.data?.recent ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1 text-xs">{JOB_LABEL[r.job_name] ?? r.job_name}</td>
                <td className="px-3 py-1 text-xs">{fmtTs(r.started_at)}</td>
                <td className="px-3 py-1 text-xs">
                  <span className={r.ok ? "text-emerald-700 font-bold" : "text-destructive font-bold"}>
                    {r.ok ? "OK" : "Fail"}
                  </span>
                  {r.error_text && <span className="ml-2 text-[10px] text-muted-foreground">{r.error_text}</span>}
                </td>
                <td className="px-3 py-1 text-right tabular-nums">{r.processed}</td>
                <td className="px-3 py-1 text-right tabular-nums">{r.failed}</td>
                <td className="px-3 py-1 text-xs">{r.triggered_by}</td>
              </tr>
            ))}
            {(cronQ.data?.recent ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-sm">No cron runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border border-border rounded-sm bg-card p-4">
        <h3 className="font-bold mb-2">Adjust trip fees</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Update the platform fee and/or referral fee on a trip. Provider net and any pending balance entry are updated automatically. An audit record is written for every change.
        </p>
        <form onSubmit={submitFeeAdjust} className="grid gap-3 md:grid-cols-4">
          <label className="md:col-span-2 text-xs">
            <span className="block font-bold uppercase text-muted-foreground mb-1">Trip ID</span>
            <input value={feeTripId} onChange={(e) => setFeeTripId(e.target.value)}
              placeholder="uuid" className="w-full border border-input bg-background rounded-sm px-3 py-1.5" />
          </label>
          <label className="text-xs">
            <span className="block font-bold uppercase text-muted-foreground mb-1">New platform fee (USD)</span>
            <input type="number" min="0" step="0.01" value={feePlatform} onChange={(e) => setFeePlatform(e.target.value)}
              placeholder="—" className="w-full border border-input bg-background rounded-sm px-3 py-1.5" />
          </label>
          <label className="text-xs">
            <span className="block font-bold uppercase text-muted-foreground mb-1">New referral fee (USD)</span>
            <input type="number" min="0" step="0.01" value={feeReferral} onChange={(e) => setFeeReferral(e.target.value)}
              placeholder="—" className="w-full border border-input bg-background rounded-sm px-3 py-1.5" />
          </label>
          <label className="md:col-span-3 text-xs">
            <span className="block font-bold uppercase text-muted-foreground mb-1">Reason</span>
            <input value={feeReason} onChange={(e) => setFeeReason(e.target.value)}
              placeholder="e.g. Referral fee waiver approved by admin" className="w-full border border-input bg-background rounded-sm px-3 py-1.5" />
          </label>
          <div className="md:col-span-1 flex items-end">
            <button type="submit" disabled={feeBusy}
              className="w-full text-xs font-bold uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground disabled:opacity-50">
              {feeBusy ? "Saving…" : "Apply adjustment"}
            </button>
          </div>
        </form>
      </div>

      <div className="border border-border rounded-sm bg-card">
        <div className="px-4 py-2 text-xs font-bold uppercase border-b border-border">Admin audit trail</div>
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-1">When</th>
              <th className="text-left px-3 py-1">Action</th>
              <th className="text-left px-3 py-1">Trip</th>
              <th className="text-right px-3 py-1">Amount</th>
              <th className="text-left px-3 py-1">Reason / Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(auditQ.data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-1 text-xs">{fmtTs(a.created_at)}</td>
                <td className="px-3 py-1 text-xs font-bold">{a.action}</td>
                <td className="px-3 py-1 font-mono text-[11px]">{a.trip_id ? a.trip_id.slice(0, 8) : "—"}</td>
                <td className="px-3 py-1 text-right tabular-nums">{a.amount_cents != null ? formatCents(a.amount_cents) : "—"}</td>
                <td className="px-3 py-1 text-xs text-muted-foreground max-w-md truncate">
                  {a.reason}
                  {a.metadata && Object.keys(a.metadata).length > 0 && (
                    <span className="ml-2 text-[10px]">{JSON.stringify(a.metadata)}</span>
                  )}
                </td>
              </tr>
            ))}
            {(auditQ.data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-sm">No admin actions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
