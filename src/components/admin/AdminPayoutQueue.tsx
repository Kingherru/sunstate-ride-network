import { StatusPill } from "@/components/ds/status";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminReleaseTripPayout, listAdminPayoutQueue } from "@/lib/payouts.functions";
import { formatUsd } from "@/lib/payouts";
import { useAdminLevel } from "@/lib/use-admin-level";
import { ReadOnlyBadge } from "@/components/ds/ReadOnlyBadge";
import {RecordTable} from "@/components/portal/RecordTable";
import {DsButton} from "@/components/ds/controls";

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
  const level = useAdminLevel("payouts");
  const readOnly = level !== "manage";
  const listFn = useServerFn(listAdminPayoutQueue);
  const releaseFn = useServerFn(adminReleaseTripPayout);
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-payout-queue"],
    queryFn: async () => {
      const res = await listFn();
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
          <div className="flex items-center gap-2"><h3 className="text-lg font-extrabold tracking-tight">Payout release queue</h3>{readOnly && <ReadOnlyBadge />}</div>
          <p className="text-xs text-muted-foreground">
            48-hour standard hold · Net-15 for Medicaid · auto-released by cron once eligible ·
            admin can override or clear holds.
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-payout-queue"] })}
          className="portal-secondary-control text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border border-border hover:bg-muted/40"
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
        <RecordTable<Row> tableId="admin-payout-release-queue" rows={rows} rowKey={r=>r.id} columns={[
{id:'trip',label:'Trip',width:180,minWidth:160,wrap:true,render:r=>{

return <>
                      <div>{r.display_id ?? r.id.slice(0, 8)}</div>
                      <div className="text-[10px] text-muted-foreground">{r.pickup_date ?? ""}</div>
                    </>;}},
{id:'payer',label:'Payer',width:210,minWidth:190,wrap:true,render:r=>{

return <>
                      {r.payout_is_medicaid ? (
                        <span className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase bg-primary/10 text-primary">
                          Medicaid · Net-15
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{r.payer ?? "Standard"}</span>
                      )}
                    </>;}},
{id:'payment',label:'Payment',width:190,minWidth:170,wrap:true,render:r=>{

return <>
                      <StatusPill status={r.payment_status ?? "unknown"} tone={r.payment_status === "paid" ? "green" : "yellow"} />
                    </>;}},
{id:'net',label:'Net payout',width:170,minWidth:150,wrap:true,render:r=>{
                const net = r.provider_payout_cents ?? 0;
return <><span className="portal-money">{formatUsd(net)}</span></>;}},
{id:'eligible',label:'Eligible',width:170,minWidth:150,wrap:true,render:r=>{

return <>{fmtWhen(r.payout_eligible_at)}</>;}},
{id:'status',label:'Status / hold',width:260,minWidth:240,wrap:true,render:r=>{
                const eligibleMs = r.payout_eligible_at ? Date.parse(r.payout_eligible_at) : null;
                const eligible = !eligibleMs || eligibleMs <= Date.now();
                const isHeld = r.payout_status === "held";
return <>
                      {isHeld ? (
                        <div>
                          <StatusPill status="Held" tone="red" />
                          {r.payout_hold_reasons && r.payout_hold_reasons.length > 0 && (
                            <div className="text-muted-foreground">{r.payout_hold_reasons.join(", ")}</div>
                          )}
                        </div>
                      ) : eligible ? (
                        <StatusPill status="Ready" tone="green" />
                      ) : (
                        <span className="font-bold uppercase text-[10px] text-muted-foreground">In hold window</span>
                      )}
                    </>;}},
{id:'actions',label:'Action',width:220,minWidth:200,wrap:true,render:r=>{
                const eligibleMs = r.payout_eligible_at ? Date.parse(r.payout_eligible_at) : null;
                const eligible = !eligibleMs || eligibleMs <= Date.now();
                const isHeld = r.payout_status === "held";
return <>
                      {readOnly ? (
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">View only</span>
                      ) : (
                        <div className="portal-record-actions">
                          {eligible && !isHeld && (
                            <DsButton size="sm" variant="secondary" disabled={busyId === r.id}
                              onClick={() => onRelease(r, false)}
                            >
                              Release
                            </DsButton>
                          )}
                          <DsButton size="sm" variant="secondary" disabled={busyId === r.id}
                            onClick={() => onRelease(r, true)}
                            title="Bypass the hold window and attempt release now"
                          >
                            Override
                          </DsButton>
                        </div>
                      )}
                    </>;}}
        ]}/>
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
