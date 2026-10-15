import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyProviderBalanceDetailed, requestCashout, getFinSettings } from "@/lib/finance/finance.functions";
import { formatCents } from "@/lib/finance/constants";

/**
 * Provider Balance panel — the single money surface for providers.
 * Shows available/pending/lifetime, per-trip line items with the expected
 * payout date and the hold-release reason, cash-out control, and history.
 */
export function ProviderBalancePanel() {
  const qc = useQueryClient();
  const load = useServerFn(getMyProviderBalanceDetailed);
  const cashout = useServerFn(requestCashout);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const settingsQ = useQuery({ queryKey: ["fin-settings"], queryFn: () => getFinSettings(), staleTime: 60_000 });
  const q = useQuery({ queryKey: ["provider-balance-detailed"], queryFn: () => load(), refetchInterval: 30_000 });

  const balance = q.data?.balance ?? { available_cents: 0, pending_cents: 0, lifetime_paid_out_cents: 0 };
  const entries = q.data?.entries ?? [];
  const cashouts = q.data?.cashouts ?? [];
  const pending = entries.filter((l) => l.state === "pending");
  const available = entries.filter((l) => l.state === "available" && l.kind !== "cashout");

  async function submitCashout() {
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 1) { toast.error("Enter at least $1.00"); return; }
    const cents = Math.round(dollars * 100);
    if (cents > (balance.available_cents ?? 0)) { toast.error("Exceeds available balance"); return; }
    setBusy(true);
    try {
      await cashout({ data: { amount_cents: cents } });
      toast.success("Cash-out requested — funds arrive within 1–2 business days");
      setAmount("");
      await qc.invalidateQueries({ queryKey: ["provider-balance-detailed"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cash-out failed");
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Provider Balance</h2>
        <p className="text-sm text-muted-foreground">
          Earnings are held for {settingsQ.data?.standard_hold_days ?? 3} days after trip validation
          (Net {settingsQ.data?.medicaid_net_business_days ?? 15} business days for Medicaid), then moved
          to your available balance. Cash out anytime.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-border rounded-sm p-4 bg-card">
          <div className="text-xs font-bold uppercase text-muted-foreground">Available</div>
          <div className="text-3xl font-black tabular-nums text-emerald-700">{formatCents(balance.available_cents)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Ready to cash out</div>
        </div>
        <div className="border border-border rounded-sm p-4 bg-card">
          <div className="text-xs font-bold uppercase text-muted-foreground">Pending (holding)</div>
          <div className="text-3xl font-black tabular-nums text-amber-700">{formatCents(balance.pending_cents)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Waiting for hold window to end</div>
        </div>
        <div className="border border-border rounded-sm p-4 bg-card">
          <div className="text-xs font-bold uppercase text-muted-foreground">Lifetime paid out</div>
          <div className="text-3xl font-black tabular-nums">{formatCents(balance.lifetime_paid_out_cents)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">All completed cash-outs</div>
        </div>
      </div>

      <div className="border border-border rounded-sm p-4 bg-card">
        <h3 className="font-bold mb-2">Cash out</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-xs font-bold uppercase text-muted-foreground mb-1">Amount (USD)</span>
            <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" className="w-40 border border-input bg-background rounded-sm px-3 py-1.5" />
          </label>
          <button type="button"
            onClick={() => setAmount(((balance.available_cents ?? 0) / 100).toFixed(2))}
            className="text-xs font-bold uppercase px-2 py-1 rounded-sm border border-border">Max</button>
          <button type="button" disabled={busy || (balance.available_cents ?? 0) < 100}
            onClick={submitCashout}
            className="text-xs font-bold uppercase px-4 py-2 rounded-sm bg-primary text-primary-foreground disabled:opacity-50">
            {busy ? "Requesting…" : "Cash out"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Minimum $1.00. Transfers go to your connected bank via Stripe within 1–2 business days.
          You'll receive an email confirmation when your cash-out completes.
        </p>
      </div>

      {pending.length > 0 && (
        <div className="border border-border rounded-sm bg-card">
          <div className="px-4 py-2 text-xs font-bold uppercase border-b border-border">
            Pending line items — {pending.length}
          </div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground bg-muted/30">
              <tr>
                <th className="text-left px-3 py-1">Trip</th>
                <th className="text-left px-3 py-1">Type</th>
                <th className="text-right px-3 py-1">Amount</th>
                <th className="text-left px-3 py-1">Available on</th>
                <th className="text-left px-3 py-1">Hold reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pending.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-1 font-mono text-[11px]">{p.trip_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-3 py-1 text-xs">
                    {p.trip_is_medicaid
                      ? <span className="text-amber-700 font-bold">Medicaid</span>
                      : <span>Standard</span>}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">{formatCents(p.amount_cents)}</td>
                  <td className="px-3 py-1 text-xs">
                    {p.available_at
                      ? new Date(p.available_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                      : "Pending Medicaid receipt"}
                  </td>
                  <td className="px-3 py-1 text-[11px] text-muted-foreground">{p.release_reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {available.length > 0 && (
        <div className="border border-border rounded-sm bg-card">
          <div className="px-4 py-2 text-xs font-bold uppercase border-b border-border">
            Available line items — {available.length}
          </div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground bg-muted/30">
              <tr>
                <th className="text-left px-3 py-1">Trip</th>
                <th className="text-left px-3 py-1">Released</th>
                <th className="text-right px-3 py-1">Amount</th>
                <th className="text-left px-3 py-1">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {available.slice(0, 25).map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-1 font-mono text-[11px]">{a.trip_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-3 py-1 text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{formatCents(a.amount_cents)}</td>
                  <td className="px-3 py-1 text-[11px] text-muted-foreground">{a.release_reason ?? a.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border border-border rounded-sm bg-card">
        <div className="px-4 py-2 text-xs font-bold uppercase border-b border-border">Cash-out history</div>
        {cashouts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No cash-outs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-1">Requested</th>
                <th className="text-right px-3 py-1">Amount</th>
                <th className="text-left px-3 py-1">Status</th>
                <th className="text-left px-3 py-1">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cashouts.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-1 text-xs">{new Date(c.requested_at).toLocaleString()}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{formatCents(c.amount_cents)}</td>
                  <td className="px-3 py-1 text-xs capitalize">
                    {c.status}
                    {c.failure_reason && <span className="ml-1 text-destructive">— {c.failure_reason}</span>}
                  </td>
                  <td className="px-3 py-1 text-xs">{c.completed_at ? new Date(c.completed_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
