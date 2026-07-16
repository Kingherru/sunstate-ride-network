import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatUsd } from "@/lib/payouts";

type Row = {
  id: string;
  trip_id: string | null;
  provider_user_id: string;
  stripe_account_id: string;
  stripe_transfer_id: string | null;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  status: string;
  failure_reason: string | null;
  created_at: string;
  referral_fee_cents?: number | null;
  referral_fee_source_user_id?: string | null;
};

function ymOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    out.push({ value, label });
  }
  return out;
}

function monthBounds(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Row[]): string {
  const header = [
    "created_at",
    "trip_id",
    "provider_user_id",
    "stripe_account_id",
    "stripe_transfer_id",
    "gross_usd",
    "platform_fee_usd",
    "referral_fee_usd",
    "referral_fee_source_user_id",
    "net_payout_usd",
    "status",
    "failure_reason",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.trip_id ?? "",
        r.provider_user_id,
        r.stripe_account_id,
        r.stripe_transfer_id ?? "",
        (r.gross_cents / 100).toFixed(2),
        (r.fee_cents / 100).toFixed(2),
        ((r.referral_fee_cents ?? 0) / 100).toFixed(2),
        r.referral_fee_source_user_id ?? "",
        (r.net_cents / 100).toFixed(2),
        r.status,
        r.failure_reason ?? "",
      ].map(csvEscape).join(","),
    );
  }
  return lines.join("\n");
}

export function MonthlyPayoutReport({
  scope,
  providerUserId,
  title = "Monthly billing & payout report",
}: {
  scope: "provider" | "admin";
  providerUserId?: string;
  title?: string;
}) {
  const options = useMemo(ymOptions, []);
  const [ym, setYm] = useState<string>(options[0]?.value ?? "");
  const [preview, setPreview] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchRows(): Promise<Row[]> {
    const { start, end } = monthBounds(ym);
    let q = supabase
      .from("provider_payout_transfers")
      .select("id, trip_id, provider_user_id, stripe_account_id, stripe_transfer_id, gross_cents, fee_cents, net_cents, status, failure_reason, created_at")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true });
    if (scope === "provider" && providerUserId) {
      q = q.eq("provider_user_id", providerUserId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Row[];
  }

  async function handlePreview() {
    setLoading(true);
    try {
      const rows = await fetchRows();
      setPreview(rows);
      if (rows.length === 0) toast.info("No payout transfers for this month.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load report");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setLoading(true);
    try {
      const rows = preview ?? (await fetchRows());
      if (rows.length === 0) {
        toast.info("No payout transfers for this month.");
        return;
      }
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payout-report-${scope}-${ym}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${rows.length} row${rows.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download report");
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    const rows = preview ?? [];
    return rows.reduce(
      (acc, r) => {
        acc.gross += r.gross_cents;
        acc.fee += r.fee_cents;
        acc.net += r.net_cents;
        if (r.status === "paid") acc.paid += 1;
        else if (r.status === "failed") acc.failed += 1;
        else acc.pending += 1;
        return acc;
      },
      { gross: 0, fee: 0, net: 0, paid: 0, failed: 0, pending: 0 },
    );
  }, [preview]);

  return (
    <section className="bg-card border border-border rounded-sm p-5">
      <h3 className="text-lg font-extrabold tracking-tight mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {scope === "admin"
          ? "Every processed transfer across all providers for the selected month."
          : "Every processed transfer to your account for the selected month."}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Month</div>
          <select
            value={ym}
            onChange={(e) => { setYm(e.target.value); setPreview(null); }}
            className="bg-background border border-border rounded-sm px-3 py-2 font-bold"
          >
            {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </label>
        <button
          onClick={handlePreview}
          disabled={loading || !ym}
          className="border border-border font-bold px-4 py-2 rounded-sm hover:bg-muted/40 disabled:opacity-50"
        >
          {loading && preview === null ? "Loading…" : "Preview"}
        </button>
        <button
          onClick={handleDownload}
          disabled={loading || !ym}
          className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50"
        >
          Download CSV
        </button>
      </div>

      {preview && preview.length > 0 && (
        <>
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            <Stat label="Gross" value={formatUsd(totals.gross)} hint={`${preview.length} transfer${preview.length === 1 ? "" : "s"}`} />
            <Stat label="Platform fee" value={`−${formatUsd(totals.fee)}`} />
            <Stat label="Net payouts" value={formatUsd(totals.net)} hint={`${totals.paid} paid · ${totals.pending} pending · ${totals.failed} failed`} />
          </div>
          <div className="mt-4 max-h-72 overflow-auto border border-border rounded-sm">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  {scope === "admin" && <th className="text-left">Provider</th>}
                  <th className="text-left">Trip</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Fee</th>
                  <th className="text-right">Net</th>
                  <th className="text-left pl-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                    {scope === "admin" && <td className="font-mono text-xs">{r.provider_user_id.slice(0, 8)}</td>}
                    <td className="font-mono text-xs">{r.trip_id ? r.trip_id.slice(0, 8) : "—"}</td>
                    <td className="text-right tabular-nums">{formatUsd(r.gross_cents)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">−{formatUsd(r.fee_cents)}</td>
                    <td className="text-right tabular-nums font-bold">{formatUsd(r.net_cents)}</td>
                    <td className="pl-3">
                      <span className={
                        "inline-block px-2 py-0.5 rounded text-xs font-bold " +
                        (r.status === "paid" ? "bg-emerald-100 text-emerald-700"
                          : r.status === "failed" ? "bg-red-100 text-red-700"
                          : "bg-muted text-muted-foreground")
                      }>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-border rounded-sm p-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="tabular-nums font-extrabold text-xl">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
