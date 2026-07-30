import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Link } from "@tanstack/react-router";
import { CalendarIcon, SearchIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * TripHistoryPanel
 *
 * Provider-facing searchable history of fully completed trips. Kept as a
 * separate panel (not the reservations pipeline) because Trip History is a
 * permanent record: only trips with a completed/delivered/paid status appear
 * here, and the panel is optimised for looking things up after the fact
 * rather than working through an active workflow.
 *
 * Default view = completed trips from the last 30 days for the current
 * provider (created_by=me OR assigned_to=me). Providers can widen the range
 * with a calendar picker, jump to preset weekly/monthly windows, and search
 * across trip id, passenger, and pickup/dropoff address/city.
 */

type HistoryTrip = {
  id: string;
  trip_number: string | null;
  status: string | null;
  reservation_state: string | null;
  pickup_date: string;
  pickup_time: string | null;
  patient_first_name: string | null;
  patient_last_name: string | null;
  pickup_address: string | null;
  pickup_city: string | null;
  dropoff_address: string | null;
  dropoff_city: string | null;

  payment_status: string | null;
  payout_status: string | null;
  cost_total: number | null;
  provider_payout_cents: number | null;
  driver_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};


type ViewMode = "list" | "weekly" | "monthly";
type Preset = "7d" | "30d" | "week" | "month" | "last_month" | "all" | "custom";
type CompletionFilter = "all" | "completed" | "needs_completion";

const COMPLETED_STATUSES = ["completed", "complete", "delivered", "paid"];
const CANCELED_STATUSES = ["canceled", "cancelled", "declined", "expired"];

function isCompleted(t: { status: string | null }): boolean {
  return COMPLETED_STATUSES.includes((t.status ?? "").toLowerCase());
}
function isCanceled(t: { status: string | null }): boolean {
  return CANCELED_STATUSES.includes((t.status ?? "").toLowerCase());
}


function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay(); // 0 Sun .. 6 Sat
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
}

function presetRange(p: Preset): { from: Date; to: Date } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (p === "all") return null;
  if (p === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from, to: today };
  }
  if (p === "30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from, to: today };
  }
  if (p === "week") {
    const from = startOfWeek(today);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    return { from, to };
  }
  if (p === "month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from, to };
  }
  if (p === "last_month") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from, to };
  }
  return null;
}

function fmtUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function paymentPillClass(s: string | null): string {
  const v = (s ?? "").toLowerCase();
  if (v === "paid" || v === "captured") return "bg-emerald-100 text-emerald-800";
  if (v === "refunded") return "bg-rose-100 text-rose-800";
  if (v === "failed") return "bg-red-100 text-red-800";
  if (v === "pending" || v === "authorized") return "bg-amber-100 text-amber-800";
  return "bg-muted text-muted-foreground";
}

function payoutPillClass(s: string | null): string {
  const v = (s ?? "").toLowerCase();
  if (v === "paid" || v === "released" || v === "completed") return "bg-emerald-100 text-emerald-800";
  if (v === "failed") return "bg-red-100 text-red-800";
  if (v === "held" || v === "pending" || v === "eligible") return "bg-amber-100 text-amber-800";
  return "bg-muted text-muted-foreground";
}

function groupKeyWeekly(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `Week of ${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

function groupKeyMonthly(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  return format(d, "MMMM yyyy");
}

function groupKeyDaily(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  return format(d, "EEEE, MMM d, yyyy");
}

export function TripHistoryPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [preset, setPreset] = useState<Preset>("30d");
  const initialRange = presetRange("30d")!;
  const [range, setRange] = useState<DateRange | undefined>({ from: initialRange.from, to: initialRange.to });
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [completion, setCompletion] = useState<CompletionFilter>("all");

  function applyPreset(p: Preset) {
    setPreset(p);
    const r = presetRange(p);
    if (r) setRange({ from: r.from, to: r.to });
    else setRange(undefined);
  }

  const fromIso = range?.from ? toIso(range.from) : null;
  const toIsoStr = range?.to ? toIso(range.to) : null;

  const q = useQuery({
    queryKey: ["trip-history", userId, fromIso, toIsoStr],
    enabled: !!userId,
    queryFn: async (): Promise<HistoryTrip[]> => {
      // History = completed trips PLUS any trip whose scheduled date has already
      // passed, even if it was never marked completed. `reservation_state` is
      // kept in sync by a cron job; the pickup_date check catches trips whose
      // time elapsed since the last sync.
      const todayIso = toIso(new Date());
      let query = supabase
        .from("trips")
        .select(
          "id, trip_number, status, reservation_state, pickup_date, pickup_time, patient_first_name, patient_last_name, pickup_address, pickup_city, dropoff_address, dropoff_city, payment_status, payout_status, cost_total, provider_payout_cents, driver_id, assigned_to, created_by, completed_at, updated_at, created_at",
        )
        .or(
          `status.in.(${COMPLETED_STATUSES.join(",")}),reservation_state.in.(past,history),pickup_date.lt.${todayIso}`,
        )
        .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
        .order("pickup_date", { ascending: false })
        .limit(1000);
      if (fromIso) query = query.gte("pickup_date", fromIso);
      if (toIsoStr) query = query.lte("pickup_date", toIsoStr);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as HistoryTrip[];
    },
  });

  // Keep history in step with status changes made in the Provider, Dispatch, or
  // Admin portals (assignment, completion, payment) without a manual refresh.
  useEffect(() => {
    const ch = supabase
      .channel(`trip-history-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => {
        qc.invalidateQueries({ queryKey: ["trip-history"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);


  const allTrips = q.data ?? [];
  const driverIds = useMemo(
    () => Array.from(new Set(allTrips.map((t) => t.driver_id).filter(Boolean) as string[])),
    [allTrips],
  );
  const driversQ = useQuery({
    queryKey: ["trip-history-drivers", driverIds.sort().join(",")],
    enabled: driverIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("id, first_name, last_name")
        .in("id", driverIds);
      const map = new Map<string, string>();
      for (const d of (data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
        map.set(d.id, [d.first_name, d.last_name].filter(Boolean).join(" ") || "Driver");
      }
      return map;
    },
  });
  const driverMap = driversQ.data ?? new Map<string, string>();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allTrips.filter((t) => {
      // Canceled/expired trips live in the Past tab, not the history record.
      if (isCanceled(t) && !isCompleted(t)) return false;
      if (completion === "completed" && !isCompleted(t)) return false;
      if (completion === "needs_completion" && isCompleted(t)) return false;
      if (paymentFilter === "paid" && (t.payment_status ?? "").toLowerCase() !== "paid") return false;
      if (paymentFilter === "unpaid" && (t.payment_status ?? "").toLowerCase() === "paid") return false;
      if (!s) return true;
      const hay = [
        t.trip_number ?? "",
        t.id.slice(0, 8),
        t.patient_first_name ?? "",
        t.patient_last_name ?? "",
        t.pickup_address ?? "",
        t.pickup_city ?? "",
        t.dropoff_address ?? "",
        t.dropoff_city ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [allTrips, search, paymentFilter, completion]);

  const needsCompletionCount = useMemo(
    () => filtered.filter((t) => !isCompleted(t)).length,
    [filtered],
  );


  const grouped = useMemo(() => {
    const map = new Map<string, HistoryTrip[]>();
    for (const t of filtered) {
      const key =
        view === "monthly"
          ? groupKeyMonthly(t.pickup_date)
          : view === "weekly"
          ? groupKeyWeekly(t.pickup_date)
          : groupKeyDaily(t.pickup_date);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered, view]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        acc.count += 1;
        acc.revenue += t.cost_total ?? 0;
        acc.payout += t.provider_payout_cents ?? 0;
        return acc;
      },
      { count: 0, revenue: 0, payout: 0 },
    );
  }, [filtered]);

  const rangeLabel = range?.from
    ? range.to
      ? `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`
      : format(range.from, "MMM d, yyyy")
    : "All time";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Trip History</h2>
        <p className="text-sm text-muted-foreground">
          Every trip whose scheduled date has passed, including trips still awaiting completion.
          Records are retained for at least two years. Search or filter to find any past trip and
          drill into payment, payout, and driver details.
        </p>
        {needsCompletionCount > 0 && (
          <p className="mt-1 text-sm font-semibold text-amber-800">
            {needsCompletionCount} trip{needsCompletionCount === 1 ? "" : "s"} in this range still
            need completion details.
          </p>
        )}

      </div>

      {/* Filter toolbar */}
      <div className="bg-card border border-border rounded-sm p-3 sm:p-4 space-y-3">
        {/* Presets */}
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["7d", "Last 7 days"],
              ["30d", "Last 30 days"],
              ["week", "This week"],
              ["month", "This month"],
              ["last_month", "Last month"],
              ["all", "All time"],
            ] as [Preset, string][]
          ).map(([p, label]) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border transition-colors",
                preset === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date range + search + view */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal w-full md:w-[280px]",
                  !range?.from && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {rangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => {
                  setRange(r);
                  setPreset("custom");
                }}
                numberOfMonths={2}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <div className="relative flex-1 min-w-0">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trip #, passenger, pickup, drop-off…"
              className="w-full text-sm bg-background border border-border rounded-sm pl-8 pr-3 py-2"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as "all" | "paid" | "unpaid")}
            className="text-xs font-bold uppercase tracking-wider bg-background border border-border rounded-sm px-3 py-2"
            aria-label="Filter by payment status"
          >
            <option value="all">All payments</option>
            <option value="paid">Paid only</option>
            <option value="unpaid">Unpaid / pending</option>
          </select>

          <select
            value={completion}
            onChange={(e) => setCompletion(e.target.value as CompletionFilter)}
            className="text-xs font-bold uppercase tracking-wider bg-background border border-border rounded-sm px-3 py-2"
            aria-label="Filter by completion status"
          >
            <option value="all">All trips</option>
            <option value="completed">Completed only</option>
            <option value="needs_completion">Needs completion</option>
          </select>


          <div className="inline-flex bg-background border border-border rounded-sm p-0.5">
            {(["list", "weekly", "monthly"] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {v === "list" ? "Daily" : v === "weekly" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>

        {/* Summary line */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground pt-1 border-t border-border">
          <span>
            <span className="text-foreground font-bold">{totals.count}</span> trip{totals.count === 1 ? "" : "s"}
          </span>
          <span>
            Revenue <span className="text-foreground font-bold">{fmtUsd(totals.revenue)}</span>
          </span>
          <span>
            Payout <span className="text-foreground font-bold">{fmtUsd(totals.payout)}</span>
          </span>
          <span className="ml-auto">{rangeLabel}</span>
        </div>
      </div>

      {/* Results */}
      {q.isLoading && <div className="text-sm text-muted-foreground">Loading trip history…</div>}
      {q.isError && (
        <div className="bg-card border border-border rounded-sm p-8 text-sm text-destructive">
          Could not load trip history. Please try again.
        </div>
      )}
      {!q.isLoading && filtered.length === 0 && (
        <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">
          No completed trips match these filters. Try widening the date range or clearing the search.
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(([groupKey, trips]) => (
          <section key={groupKey}>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <span>{groupKey}</span>
              <span className="text-foreground">
                · {trips.length} trip{trips.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-2">
              {trips.map((t) => (
                <TripHistoryCard
                  key={t.id}
                  trip={t}
                  driverName={t.driver_id ? driverMap.get(t.driver_id) ?? null : null}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function TripHistoryCard({ trip, driverName }: { trip: HistoryTrip; driverName: string | null }) {
  const tripNo = trip.trip_number ?? `#${trip.id.slice(0, 8)}`;
  const passenger = [trip.patient_first_name, trip.patient_last_name].filter(Boolean).join(" ") || "—";
  const completedOn = trip.completed_at
    ? new Date(trip.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : trip.pickup_date;

  return (
    <div className="bg-card border border-border rounded-sm p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-foreground">{tripNo}</span>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm",
                paymentPillClass(trip.payment_status),
              )}
            >
              Pay: {trip.payment_status ?? "—"}
            </span>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm",
                payoutPillClass(trip.payout_status),
              )}
            >
              Payout: {trip.payout_status ?? "—"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700">
              {trip.status}
            </span>
          </div>

          {/* Passenger + route */}
          <div className="font-extrabold truncate">{passenger}</div>
          <div className="text-sm text-muted-foreground mt-0.5 truncate">
            {trip.pickup_address}
            {trip.pickup_city ? `, ${trip.pickup_city}` : ""} → {trip.dropoff_address}
            {trip.dropoff_city ? `, ${trip.dropoff_city}` : ""}
          </div>

          {/* Meta grid */}
          <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
            <div>
              <dt className="uppercase tracking-wide text-[10px] text-muted-foreground font-bold">Completed</dt>
              <dd className="text-foreground">{completedOn}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-[10px] text-muted-foreground font-bold">Driver</dt>
              <dd className="text-foreground truncate">{driverName ?? "—"}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-[10px] text-muted-foreground font-bold">Fare</dt>
              <dd className="text-foreground tabular-nums">{fmtUsd(trip.cost_total)}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide text-[10px] text-muted-foreground font-bold">Payout</dt>
              <dd className="text-foreground tabular-nums">{fmtUsd(trip.provider_payout_cents)}</dd>
            </div>
          </dl>
        </div>

        <div className="sm:shrink-0">
          <Link
            to="/reservations/$id/review"
            params={{ id: trip.id }}
            className="inline-flex items-center justify-center text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted w-full sm:w-auto"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}
