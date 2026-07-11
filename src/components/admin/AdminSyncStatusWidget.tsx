import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

type ModuleSpec = {
  id: string;
  label: string;
  table: string;
  timeCol: "created_at" | "updated_at";
  /** Optional row filter, applied as `.eq(col, val)` */
  filter?: { col: string; val: string };
  /** If true, an empty table is reported as N/A rather than red. */
  emptyOk?: boolean;
};

const MODULES: ModuleSpec[] = [
  { id: "trips", label: "Trips", table: "trips", timeCol: "updated_at", emptyOk: true },
  { id: "reservations", label: "Reservations", table: "ride_requests", timeCol: "created_at", emptyOk: true },
  { id: "dispatchers", label: "Dispatchers", table: "user_roles", timeCol: "created_at", filter: { col: "role", val: "dispatcher" }, emptyOk: true },
  { id: "patients", label: "Patients", table: "saved_patients", timeCol: "updated_at", emptyOk: true },
  { id: "referrals", label: "Referrals", table: "facility_saved_providers", timeCol: "created_at", emptyOk: true },
  { id: "messages", label: "Messages", table: "messages", timeCol: "created_at", emptyOk: true },
  { id: "payments", label: "Payments", table: "trip_payments", timeCol: "updated_at", emptyOk: true },
  { id: "memberships", label: "Memberships", table: "subscriptions", timeCol: "updated_at", emptyOk: true },
  { id: "documents", label: "Documents", table: "medicaid_packet_items", timeCol: "created_at", emptyOk: true },
  { id: "notifications", label: "Notifications", table: "notifications", timeCol: "created_at", emptyOk: true },
];

const WARN_MS = 15 * 60 * 1000;  // 15 min
const FAIL_MS = 60 * 60 * 1000;  // 1 hr

type ModuleStatus = {
  id: string;
  label: string;
  table: string;
  count: number;
  lastAt: string | null;
  error: string | null;
};

async function fetchModule(spec: ModuleSpec): Promise<ModuleStatus> {
  try {
    let head = supabase.from(spec.table as never).select("*", { count: "exact", head: true });
    if (spec.filter) head = (head as never as { eq: (c: string, v: string) => typeof head }).eq(spec.filter.col, spec.filter.val);
    const { count, error: cErr } = await head;
    if (cErr) throw cErr;

    let q = supabase.from(spec.table as never).select(spec.timeCol).order(spec.timeCol, { ascending: false }).limit(1);
    if (spec.filter) q = (q as never as { eq: (c: string, v: string) => typeof q }).eq(spec.filter.col, spec.filter.val);
    const { data, error } = await q;
    if (error) throw error;
    const row = (data?.[0] ?? null) as Record<string, string> | null;
    return {
      id: spec.id,
      label: spec.label,
      table: spec.table,
      count: count ?? 0,
      lastAt: row ? row[spec.timeCol] ?? null : null,
      error: null,
    };
  } catch (e) {
    return {
      id: spec.id,
      label: spec.label,
      table: spec.table,
      count: 0,
      lastAt: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function statusFor(m: ModuleStatus, spec: ModuleSpec): { tone: "ok" | "warn" | "fail" | "na" | "err"; text: string } {
  if (m.error) return { tone: "err", text: "Sync failed" };
  if (m.count === 0) return spec.emptyOk ? { tone: "na", text: "No records yet" } : { tone: "fail", text: "Empty" };
  if (!m.lastAt) return { tone: "warn", text: "No timestamp" };
  const age = Date.now() - new Date(m.lastAt).getTime();
  if (age > FAIL_MS) return { tone: "fail", text: `Stale ${fmtAge(age)}` };
  if (age > WARN_MS) return { tone: "warn", text: `Aging ${fmtAge(age)}` };
  return { tone: "ok", text: `Fresh ${fmtAge(age)}` };
}

function fmtAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AdminSyncStatusWidget() {
  const q = useQuery({
    queryKey: ["admin", "sync-status"],
    queryFn: async () => Promise.all(MODULES.map(fetchModule)),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const rows = q.data ?? [];
  const lastChecked = q.dataUpdatedAt ? new Date(q.dataUpdatedAt) : null;
  const anyFail = rows.some((r) => {
    const s = statusFor(r, MODULES.find((m) => m.id === r.id)!);
    return s.tone === "fail" || s.tone === "err";
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-1">
            Platform sync monitor
          </p>
          <h3 className="text-lg font-extrabold tracking-tight">Admin Portal data freshness</h3>
          <p className="text-xs text-muted mt-1">
            Warn &gt; 15 min · Fail &gt; 1 hr. Auto-refreshes every 30 s.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          {anyFail ? (
            <span className="inline-flex items-center gap-1 text-destructive font-semibold">
              <AlertTriangle className="size-4" /> Attention
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-success font-semibold">
              <CheckCircle2 className="size-4" /> All in sync
            </span>
          )}
          <button
            type="button"
            onClick={() => q.refetch()}
            className="inline-flex items-center gap-1 px-2 py-1 border border-border rounded-sm hover:border-primary/40"
            disabled={q.isFetching}
          >
            <RefreshCw className={`size-3 ${q.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {MODULES.map((spec) => {
          const row = rows.find((r) => r.id === spec.id);
          if (!row) {
            return (
              <div key={spec.id} className="border border-border rounded-sm p-3">
                <p className="text-xs font-mono text-muted">Loading…</p>
                <p className="font-bold">{spec.label}</p>
              </div>
            );
          }
          const s = statusFor(row, spec);
          const toneClass =
            s.tone === "ok" ? "border-success/40 bg-success/5"
            : s.tone === "warn" ? "border-warning/40 bg-warning/5"
            : s.tone === "fail" ? "border-destructive/50 bg-destructive/5"
            : s.tone === "err" ? "border-destructive/60 bg-destructive/10"
            : "border-border";
          const Icon =
            s.tone === "ok" ? CheckCircle2
            : s.tone === "warn" ? AlertTriangle
            : s.tone === "fail" || s.tone === "err" ? XCircle
            : HelpCircle;
          return (
            <div key={spec.id} className={`border rounded-sm p-3 ${toneClass}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold">{spec.label}</p>
                <Icon className="size-4 opacity-70" />
              </div>
              <p className="font-mono text-[11px] text-muted mt-0.5">{spec.table}</p>
              <p className="text-xs mt-2 font-semibold">{s.text}</p>
              <p className="text-[11px] text-muted mt-1">
                {row.count.toLocaleString()} record{row.count === 1 ? "" : "s"}
              </p>
              {row.error && (
                <p className="text-[10px] text-destructive mt-1 line-clamp-2" title={row.error}>
                  {row.error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {lastChecked && (
        <p className="text-[11px] text-muted mt-4 font-mono">
          Last checked {lastChecked.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
