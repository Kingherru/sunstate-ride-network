import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminReleaseTripPayout, listAdminPayoutQueue } from "@/lib/payouts.functions";
import { formatUsd } from "@/lib/payouts";

type Row = {
  id: string; display_id: string | null; pickup_date: string | null;
  status: string; payment_status: string; payout_status: string;
  cost_total: number | null; provider_payout_cents: number | null; platform_fee_cents: number | null;
  assigned_to: string | null; created_by: string | null;
  payout_eligible_at: string | null; payout_hold_reasons: string[] | null;
  payout_is_medicaid: boolean; completed_at: string | null; payer: string | null;
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  if (mins < 60) return diff >= 0 ? `in ${mins}m` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return diff >= 0 ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return diff >= 0 ? `in ${days}d` : `${days}d ago`;
}

export function AdminPayoutQueue() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminPayoutQueue);
  const releaseFn = useServerFn(adminReleaseTripPayout);
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-payout-queue"],
    queryFn: async () => {
      const res = await listFn();
      if (!res.ok) throw new Error(res.error ?? "Failed to load queue");
      return res.rows as Row[];
    },
    refetchInterval: 30_000,
  });

  async function onRelease(row: Row, override: boolean) {
    const label = override ? "Override hold and release now?" : "Release this payout?";
    if (!window.confirm(label)) return;
    setBusyId(row.id);
    try {
      const res = await releaseFn({ data: { trip_id: row.id, override_wait: override } });
      if (res.ok) {
        toast.success(`Released ${formatUsd((res.netCents ?? 0))}`);
      } else {
        toast.error(res.error ?? "Release failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Release failed");
    } finally {
      setBusyId(null);
      qc.invalidateQueries({ queryKey: ["admin-payout-queue"] });
    }
  }

  const rows = q.data ?? [];
  const pending = rows.filter((r) => r.payout_status === "pending");
  const held = rows.filter((r) => r.payout_status === "held");

  return (
    <section className="bg-card border border-border rounded-sm p-5">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight">Payout release queue</h3>
          <p className="text-xs text-muted-foreground">
            48-hour standard hold · Net-15 for Medicaid · auto-released by cron once eligible ·
            admin can override or clear holds.
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-payout-queue"] })}
          className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border border-border hover:bg-muted/40"
        >
          Refresh
        </button>
      </header>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Stat label="Awaiting release (validated)" value={String(pending.length)} tone="ok" />
        <Stat label="On hold (needs review)" value={String(held.length)} tone={held.length ? "warn" : "muted"} />
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading queue…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trips are awaiting payout release right now.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2">Trip</th>
                <th className="text-left">Payer</th>
                <th className="text-left">Payment</th>
                <th className="text-right">Net payout</th>
                <th className="text-left pl-3">Eligible</th>
                <th className="text-left">Status / hold</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const eligibleMs = r.payout_eligible_at ? Date.parse(r.payout_eligible_at) : null;
                const eligible = !eligibleMs || eligibleMs <= Date.now();
                const isHeld = r.payout_status === "held";
                const net = r.provider_payout_cents ?? 0;
                return (
                  <tr key={r.id}>
                    <td className="py-2 font-mono text-xs">
                      <div>{r.display_id ?? r.id.slice(0, 8)}</div>
                      <div className="text-[10px] text-muted-foreground">{r.pickup_date ?? ""}</div>
                    </td>
                    <td>
                      {r.payout_is_medicaid ? (
                        <span className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase bg-primary/10 text-primary">
                          Medicaid · Net-15
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{r.payer ?? "Standard"}</span>
                      )}
                    </td>
                    <td>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${r.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {r.payment_status}
                      </span>
                    </td>
                    <td className="text-right font-bold tabular-nums">{formatUsd(net)}</td>
                    <td className="pl-3 text-xs">{fmtWhen(r.payout_eligible_at)}</td>
                    <td className="text-xs">
                      {isHeld ? (
                        <div className="text-red-700">
                          <span className="font-bold uppercase text-[10px]">Held</span>
                          {r.payout_hold_reasons && r.payout_hold_reasons.length > 0 && (
                            <div className="text-muted-foreground">{r.payout_hold_reasons.join(", ")}</div>
                          )}
                        </div>
                      ) : eligible ? (
                        <span className="font-bold uppercase text-[10px] text-emerald-700">Ready</span>
                      ) : (
                        <span className="font-bold uppercase text-[10px] text-muted-foreground">In hold window</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        {eligible && !isHeld && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => onRelease(r, false)}
                            className="bg-primary text-primary-foreground font-bold text-xs uppercase px-3 py-1.5 rounded-sm hover:bg-primary/90 disabled:opacity-50"
                          >
                            Release
                          </button>
                        )}
                        <button
                          disabled={busyId === r.id}
                          onClick={() => onRelease(r, true)}
                          className="bg-card border border-border font-bold text-xs uppercase px-3 py-1.5 rounded-sm hover:bg-muted/40 disabled:opacity-50"
                          title="Bypass the hold window and attempt release now"
                        >
                          Override
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "muted" }) {
  const toneCls = tone === "warn" ? "text-red-700" : tone === "ok" ? "text-emerald-700" : "text-foreground";
  return (
    <div className="bg-muted/30 border border-border rounded-sm p-3">
      <div className={`text-2xl font-extrabold tabular-nums ${toneCls}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
