import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyProviderBalanceDetailed, requestCashout, getFinSettings } from "@/lib/finance/finance.functions";
import { formatCents } from "@/lib/finance/constants";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
import {RecordTable} from '@/components/portal/RecordTable';

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

  const settingsQ = usePortalQuery({ queryKey: ["fin-settings"], queryFn: () => getFinSettings(), staleTime: 60_000 });
  const q = usePortalQuery({ queryKey: ["provider-balance-detailed"], queryFn: () => load(), refetchInterval: 30_000 });

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
          to the recorded available balance. Release and cash-out execution remain off.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-border rounded-sm p-4 bg-card">
          <div className="text-xs font-bold uppercase text-muted-foreground">Available</div>
          <div className="text-3xl font-black tabular-nums text-emerald-700"><span className="portal-money">{formatCents(balance.available_cents)}</span></div>
          <div className="text-[11px] text-muted-foreground mt-1">Recorded available amount</div>
        </div>
        <div className="border border-border rounded-sm p-4 bg-card">
          <div className="text-xs font-bold uppercase text-muted-foreground">Pending (holding)</div>
          <div className="text-3xl font-black tabular-nums text-amber-700"><span className="portal-money">{formatCents(balance.pending_cents)}</span></div>
          <div className="text-[11px] text-muted-foreground mt-1">Hold and receipt evidence required</div>
        </div>
        <div className="border border-border rounded-sm p-4 bg-card">
          <div className="text-xs font-bold uppercase text-muted-foreground">Lifetime paid out</div>
          <div className="text-3xl font-black tabular-nums"><span className="portal-money">{formatCents(balance.lifetime_paid_out_cents)}</span></div>
          <div className="text-[11px] text-muted-foreground mt-1">All completed cash-outs</div>
        </div>
      </div>

      <section className="portal-business-section"><h3 className="portal-business-heading ds-label">Transfers & releases</h3><div className="portal-business-body"><p className="ds-support">Financial execution is off. Recorded availability does not authorize a transfer or release.</p></div></section>

      {pending.length > 0 && (
        <div className="portal-business-section">
          <div className="portal-business-heading ds-label">
            Pending line items — {pending.length}
          </div>
          <RecordTable tableId="provider-pending-balance" rows={pending} rowKey={p=>p.id} columns={[
            {id:'trip',label:'Trip',width:170,render:p=>p.trip_id?.slice(0,8)??'—'},
            {id:'type',label:'Type',width:170,render:p=>p.trip_is_medicaid?'Medicaid':'Transportation — payer not identified'},
            {id:'amount',label:'Amount',width:160,render:p=><span className="portal-money">{formatCents(p.amount_cents)}</span>},
            {id:'available',label:'Available on',width:230,render:p=>p.available_at?new Date(p.available_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Pending Medicaid receipt'},
            {id:'reason',label:'Hold reason',width:250,render:p=>p.release_reason??'—'},
          ]}/>
        </div>
      )}

      {available.length > 0 && (
        <div className="portal-business-section">
          <div className="portal-business-heading ds-label">
            Available line items — {available.length}
          </div>
          <RecordTable tableId="provider-available-balance" rows={available.slice(0,25)} rowKey={a=>a.id} columns={[
            {id:'trip',label:'Trip',width:170,render:a=>a.trip_id?.slice(0,8)??'—'},
            {id:'released',label:'Released',width:200,render:a=>new Date(a.created_at).toLocaleDateString()},
            {id:'amount',label:'Amount',width:170,render:a=><span className="portal-money">{formatCents(a.amount_cents)}</span>},
            {id:'note',label:'Note',width:280,render:a=>a.release_reason??a.note??'—'},
          ]}/>
        </div>
      )}

      <div className="portal-business-section">
        <div className="portal-business-heading ds-label">Cash-out history</div>
        {cashouts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">No cash-outs yet.</div>
        ) : (
          <RecordTable tableId="provider-cashout-history" rows={cashouts} rowKey={c=>c.id} columns={[
            {id:'requested',label:'Requested',width:230,render:c=>new Date(c.requested_at).toLocaleString()},
            {id:'amount',label:'Amount',width:170,render:c=><span className="portal-money">{formatCents(c.amount_cents)}</span>},
            {id:'status',label:'Status',minWidth:200,width:250,wrap:true,render:c=><>{c.status}{c.failure_reason&&<span className="ml-1 text-ds-error">— {c.failure_reason}</span>}</>},
            {id:'completed',label:'Completed',width:230,render:c=>c.completed_at?new Date(c.completed_at).toLocaleString():'—'},
          ]}/>
        )}
      </div>
    </section>
  );
}
