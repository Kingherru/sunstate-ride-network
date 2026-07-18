import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listFinLedger,
  validateTripPayment,
  releaseTripPayout,
  refundTrip,
  getFinSettings,
} from "@/lib/finance/finance.functions";
import {
  formatCents,
  PAYMENT_STATE_LABELS,
  PAYOUT_STATE_LABELS,
  PAYER_KIND_LABELS,
  bpsToPct,
} from "@/lib/finance/constants";

type LedgerRow = {
  trip_id: string;
  display_id: string | null;
  trip_status: string | null;
  fin_payer_kind: string | null;
  fin_payment_source: string | null;
  fin_gross_cents: number;
  fin_platform_fee_cents: number;
  fin_referral_fee_cents: number;
  fin_provider_net_cents: number;
  fin_payment_state: string;
  fin_payout_state: string;
  fin_is_medicaid: boolean;
  fin_payout_hold_until: string | null;
  fin_locked_at: string | null;
  created_at: string;
};

/**
 * NEW: Central admin finance console — replaces the old ledger + payout queue.
 * One row per trip, showing the full money picture and enabling validate /
 * release / refund actions. Nothing here mutates trip finance directly; every
 * action goes through the `fin_*` server functions.
 */
export function AdminFinanceConsole() {
  const qc = useQueryClient();
  const list = useServerFn(listFinLedger);
  const validate = useServerFn(validateTripPayment);
  const release = useServerFn(releaseTripPayout);
  const refund = useServerFn(refundTrip);

  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const settingsQ = useQuery({
    queryKey: ["fin-settings"],
    queryFn: () => getFinSettings(),
    staleTime: 60_000,
  });

  const ledgerQ = useQuery({
    queryKey: ["admin-fin-ledger"],
    queryFn: () => list({ data: { limit: 200 } }),
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => {
    const all = (ledgerQ.data ?? []) as LedgerRow[];
    if (!filter.trim()) return all;
    const f = filter.toLowerCase();
    return all.filter((r) =>
      (r.display_id ?? "").toLowerCase().includes(f)
      || (r.fin_payer_kind ?? "").toLowerCase().includes(f)
      || (r.fin_payment_state ?? "").toLowerCase().includes(f)
      || (r.fin_payout_state ?? "").toLowerCase().includes(f),
    );
  }, [ledgerQ.data, filter]);

  async function withBusy(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["admin-fin-ledger"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Finance console</h2>
          <p className="text-sm text-muted-foreground">
            Platform fee: <strong>{bpsToPct(settingsQ.data?.platform_fee_bps ?? 200)}</strong>
            {" · "}Standard hold: <strong>{settingsQ.data?.standard_hold_hours ?? 48}h</strong>
            {" · "}Medicaid hold: <strong>{settingsQ.data?.medicaid_hold_days ?? 15}d (Net-15)</strong>
          </p>
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by trip #, payer, or state"
          className="w-64 text-sm border border-input bg-background rounded-sm px-3 py-1.5"
        />
      </div>

      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2">Trip</th>
              <th className="text-left px-3 py-2">Payer</th>
              <th className="text-right px-3 py-2">Gross</th>
              <th className="text-right px-3 py-2">Platform</th>
              <th className="text-right px-3 py-2">Referral</th>
              <th className="text-right px-3 py-2">Provider net</th>
              <th className="text-left px-3 py-2">Payment</th>
              <th className="text-left px-3 py-2">Payout</th>
              <th className="text-left px-3 py-2">Hold until</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ledgerQ.isLoading && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Loading ledger…</td></tr>
            )}
            {!ledgerQ.isLoading && rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No trips match.</td></tr>
            )}
            {rows.map((r) => {
              const hold = r.fin_payout_hold_until ? new Date(r.fin_payout_hold_until) : null;
              const holdReady = hold && hold.getTime() <= Date.now();
              const canValidate = r.fin_payment_state === "paid";
              const canRelease = r.fin_payment_state === "validated" && r.fin_payout_state !== "paid_out" && holdReady;
              const canRefund = r.fin_payment_state === "paid" || r.fin_payment_state === "validated";
              return (
                <tr key={r.trip_id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{r.display_id ?? r.trip_id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-xs">
                    {PAYER_KIND_LABELS[r.fin_payer_kind ?? ""] ?? "—"}
                    {r.fin_is_medicaid && <span className="ml-1 text-[9px] font-bold text-amber-700">MCD</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCents(r.fin_gross_cents)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCents(r.fin_platform_fee_cents)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCents(r.fin_referral_fee_cents)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">{formatCents(r.fin_provider_net_cents)}</td>
                  <td className="px-3 py-2 text-xs">{PAYMENT_STATE_LABELS[r.fin_payment_state] ?? r.fin_payment_state}</td>
                  <td className="px-3 py-2 text-xs">{PAYOUT_STATE_LABELS[r.fin_payout_state] ?? r.fin_payout_state}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {hold ? hold.toLocaleString() : "—"}
                    {hold && !holdReady && <div className="text-amber-700 font-semibold">Holding</div>}
                    {hold && holdReady && r.fin_payout_state !== "paid_out" && <div className="text-emerald-700 font-semibold">Ready</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1 items-end">
                      {canValidate && (
                        <button
                          disabled={busy === r.trip_id}
                          onClick={() => withBusy(r.trip_id, () => validate({ data: { trip_id: r.trip_id } }), "Payment validated")}
                          className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm bg-primary text-primary-foreground disabled:opacity-50"
                        >Validate</button>
                      )}
                      {canRelease && (
                        <button
                          disabled={busy === r.trip_id}
                          onClick={() => withBusy(r.trip_id, () => release({ data: { trip_id: r.trip_id } }), "Payout released")}
                          className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm bg-emerald-600 text-white disabled:opacity-50"
                        >Release payout</button>
                      )}
                      {canRefund && (
                        <button
                          disabled={busy === r.trip_id}
                          onClick={() => {
                            const reason = window.prompt("Refund reason (optional)") ?? undefined;
                            withBusy(r.trip_id, () => refund({ data: { trip_id: r.trip_id, reason } }), "Trip refunded");
                          }}
                          className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm border border-border text-muted-foreground disabled:opacity-50"
                        >Refund</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
