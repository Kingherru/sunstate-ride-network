import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTripFinancialLedger, validateTripPayment } from "@/lib/payouts.functions";
import { formatUsd } from "@/lib/payouts";
import { toast } from "sonner";

type Row = {
  trip_id: string; display_id: string | null;
  payer_kind: string | null; payer_label: string | null;
  payment_source: string | null;
  gross_cents: number; platform_fee_cents: number;
  referral_fee_cents: number; provider_payout_cents: number;
  payment_status: string; payout_status: string;
  payout_hold_reasons: string[] | null;
  payout_is_medicaid: boolean | null;
  medicaid_remit_received_at: string | null;
  provider_name: string | null;
  referral_source_name: string | null;
  completed_at: string | null;
  payout_eligible_at: string | null;
  payout_released_at: string | null;
  financial_locked_at: string | null;
};

const STATUS_FILTERS = ["all", "pending_invoice", "invoiced", "paid", "validated", "refunded", "failed"] as const;

export function AdminFinancialLedger() {
  const listFn = useServerFn(listTripFinancialLedger);
  const validateFn = useServerFn(validateTripPayment);
  const qc = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-financial-ledger"],
    queryFn: () => listFn(),
  });

  const validate = useMutation({
    mutationFn: (trip_id: string) => validateFn({ data: { trip_id } }),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast.success("Payment validated");
        qc.invalidateQueries({ queryKey: ["admin-financial-ledger"] });
      } else toast.error(res?.error ?? "Failed");
    },
  });

  const rows: Row[] = (data as any)?.rows ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.payment_status !== status) return false;
      if (!q) return true;
      return [r.display_id, r.payer_label, r.provider_name, r.referral_source_name]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, status, search]);

  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    gross: acc.gross + r.gross_cents,
    fee: acc.fee + r.platform_fee_cents,
    ref: acc.ref + r.referral_fee_cents,
    net: acc.net + r.provider_payout_cents,
  }), { gross: 0, fee: 0, ref: 0, net: 0 }), [filtered]);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Trip Financial Ledger</h2>
          <p className="text-sm text-muted">One trip, one financial record. Track payer, fees, and payout status.</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Search trip / payer / provider"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Card label="Gross" value={formatUsd(totals.gross)} />
        <Card label="Platform fees" value={formatUsd(totals.fee)} />
        <Card label="Referral fees" value={formatUsd(totals.ref)} />
        <Card label="Provider payouts" value={formatUsd(totals.net)} />
      </div>

      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left">
            <tr>
              <th className="p-2">Trip</th>
              <th className="p-2">Payer</th>
              <th className="p-2">Source</th>
              <th className="p-2">Provider</th>
              <th className="p-2 text-right">Gross</th>
              <th className="p-2 text-right">Fee</th>
              <th className="p-2 text-right">Referral</th>
              <th className="p-2 text-right">Payout</th>
              <th className="p-2">Payment</th>
              <th className="p-2">Payout status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={11} className="p-4 text-center text-muted">Loading…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={11} className="p-4 text-center text-muted">No trips match.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.trip_id} className="border-t border-border">
                <td className="p-2 font-mono text-xs">{r.display_id ?? r.trip_id.slice(0, 8)}</td>
                <td className="p-2">
                  <div>{r.payer_label ?? "—"}</div>
                  {r.payer_kind && <div className="text-xs text-muted">{r.payer_kind}</div>}
                </td>
                <td className="p-2 text-xs">{r.payment_source ?? "—"}</td>
                <td className="p-2">{r.provider_name ?? "—"}</td>
                <td className="p-2 text-right">{formatUsd(r.gross_cents)}</td>
                <td className="p-2 text-right">{formatUsd(r.platform_fee_cents)}</td>
                <td className="p-2 text-right">
                  {formatUsd(r.referral_fee_cents)}
                  {r.referral_source_name && <div className="text-xs text-muted">via {r.referral_source_name}</div>}
                </td>
                <td className="p-2 text-right font-medium">{formatUsd(r.provider_payout_cents)}</td>
                <td className="p-2">
                  <Badge value={r.payment_status} />
                  {r.payout_is_medicaid && <div className="text-xs text-muted mt-1">Medicaid Net-15</div>}
                </td>
                <td className="p-2">
                  <Badge value={r.payout_status} />
                  {r.financial_locked_at && <div className="text-xs text-muted mt-1">Locked</div>}
                </td>
                <td className="p-2">
                  {["paid"].includes(r.payment_status) && (
                    <button
                      className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
                      disabled={validate.isPending}
                      onClick={() => validate.mutate(r.trip_id)}
                    >
                      Validate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const tone: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-700",
    validated: "bg-emerald-500/15 text-emerald-700",
    released: "bg-emerald-500/15 text-emerald-700",
    pending_invoice: "bg-amber-500/15 text-amber-700",
    invoiced: "bg-amber-500/15 text-amber-700",
    pending: "bg-amber-500/15 text-amber-700",
    held: "bg-orange-500/15 text-orange-700",
    failed: "bg-red-500/15 text-red-700",
    refunded: "bg-slate-500/15 text-slate-700",
  };
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded ${tone[value] ?? "bg-muted text-muted-foreground"}`}>
      {value}
    </span>
  );
}
