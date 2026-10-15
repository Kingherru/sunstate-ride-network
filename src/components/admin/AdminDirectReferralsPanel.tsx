import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listDirectReferralsAdmin } from "@/lib/admin-trips.functions";
import { suggestProvidersForTrip, autoAssignTrip } from "@/lib/assignment.functions";
import { assignmentBlockReason, isTripPaid, WAITING_ON_PAYMENT_LABEL } from "@/lib/payment-gate";
import { adminAssignTrip } from "@/lib/system-ids.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatTime12 } from "@/lib/time-format";

const SOURCE_OPTIONS = ["all", "public_form", "web", "provider", "facility", "api"];

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "warn" | "ok" }) {
  const cls =
    tone === "warn"
      ? "bg-accent text-accent-foreground"
      : tone === "ok"
        ? "bg-primary text-primary-foreground"
        : "bg-secondary text-secondary-foreground";
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

export function AdminDirectReferralsPanel() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listDirectReferralsAdmin);
  const suggestFn = useServerFn(suggestProvidersForTrip);
  const autoFn = useServerFn(autoAssignTrip);
  const assignFn = useServerFn(adminAssignTrip);

  const [source, setSource] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-direct-referrals", source],
    queryFn: () => fetchList({ data: { source } }),
  });

  // Keep Direct Referrals, Reservations, Dispatch and provider views in sync.
  const refreshAll = () => {
    for (const key of [
      "admin-direct-referrals",
      "admin-reservations",
      "admin-trips",
      "dispatch-trips",
      "trips",
      "reservations",
      "schedule-board",
      "referrals",
    ]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("admin-direct-referrals")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-direct-referrals"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const auto = useMutation({
    mutationFn: (trip_id: string) => autoFn({ data: { trip_id } }),
    onSuccess: (r: any) => {
      refreshAll();
      toast[r?.assigned_to ? "success" : "message"](
        r?.assigned_to
          ? (r?.waiting_on_payment
              ? "Trip auto-assigned — provider notified not to perform it until payment is received."
              : "Trip auto-assigned to the best-matched provider.")
          : "No eligible provider found — left for manual dispatch.",
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Auto-assign failed"),
  });

  const assign = useMutation({
    mutationFn: (v: { trip_id: string; assigned_to: string }) => assignFn({ data: v }),
    onSuccess: () => {
      refreshAll();
      setOpenId(null);
      toast.success("Provider assigned — the trip now continues in Reservations.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Assignment failed"),
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Direct Referrals</h2>
        <p className="text-xs text-muted-foreground">
          Trips from the public request form and other intake sources that have no provider assigned yet. Assign an
          eligible provider here; once accepted the trip continues through the normal reservation workflow.
        </p>
      </div>

      <div className="bg-card border border-border rounded-sm p-4 flex flex-wrap gap-3 items-center">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Source</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="border border-border rounded-sm px-3 py-2 bg-background text-sm"
        >
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} unassigned</span>
      </div>

      <div className="bg-card border border-border rounded-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left p-3">Trip ID</th>
              <th className="text-left p-3">Date / Time</th>
              <th className="text-left p-3">Patient</th>
              <th className="text-left p-3">Route</th>
              <th className="text-left p-3">Zone</th>
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Referral</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Loading direct referrals…
                </td>
              </tr>
            )}
            {q.error && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-destructive">
                  {(q.error as Error).message}
                </td>
              </tr>
            )}
            {!q.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No unassigned referrals right now.
                </td>
              </tr>
            )}
            {rows.map((t: any) => (
              <tr key={t.id} className="border-t border-border align-top">
                <td className="p-3 font-mono text-xs">{t.display_id ?? t.id.slice(0, 8)}</td>
                <td className="p-3 whitespace-nowrap">
                  {t.pickup_date} {t.pickup_time ? formatTime12(t.pickup_time) : ""}
                </td>
                <td className="p-3">
                  <div>
                    {t.patient_first_name} {t.patient_last_name}
                  </div>
                  {t.medicaid_trip && <Badge tone="warn">Medicaid</Badge>}
                </td>
                <td className="p-3 text-xs">
                  <div>
                    {t.pickup_city} {t.pickup_zip ?? ""}
                  </div>
                  <div className="text-muted-foreground">
                    ↓ {t.dropoff_city} {t.dropoff_zip ?? ""}
                  </div>
                </td>
                <td className="p-3 text-xs">{t.zone_name ?? <span className="text-muted-foreground">Unzoned</span>}</td>
                <td className="p-3 text-xs capitalize">{(t.source ?? "—").replace(/_/g, " ")}</td>
                <td className="p-3 text-xs">
                  {t.referral_status ? (
                    <div className="space-y-1">
                      <Badge tone={t.referral_status === "pending" ? "warn" : "muted"}>{t.referral_status}</Badge>
                      {t.referral_target_name && (
                        <div className="text-muted-foreground">{t.referral_target_name}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not referred</span>
                  )}
                </td>
                <td className="p-3 text-right whitespace-nowrap space-x-2">
                  {!isTripPaid(t) && (
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      {WAITING_ON_PAYMENT_LABEL}
                    </div>
                  )}
                  <button
                    onClick={() => auto.mutate(t.id)}
                    disabled={auto.isPending}
                    className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-sm bg-secondary hover:bg-muted"
                  >
                    Auto-assign
                  </button>
                  <button
                    onClick={() => setOpenId(openId === t.id ? null : t.id)}
                    disabled={!!assignmentBlockReason(t)}
                    title={assignmentBlockReason(t) ?? "Assign this trip to a provider"}
                    className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-sm bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {openId === t.id ? "Close" : "Assign"}
                  </button>
                </td>
              </tr>
            ))}
            {openId && rows.some((t: any) => t.id === openId) && (
              <tr className="border-t border-border bg-secondary/20">
                <td colSpan={8} className="p-4">
                  <ProviderPicker
                    tripId={openId}
                    suggest={(trip_id) => suggestFn({ data: { trip_id } })}
                    onAssign={(providerId) => assign.mutate({ trip_id: openId, assigned_to: providerId })}
                    assigning={assign.isPending}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProviderPicker({
  tripId,
  suggest,
  onAssign,
  assigning,
}: {
  tripId: string;
  suggest: (tripId: string) => Promise<any>;
  onAssign: (providerUserId: string) => void;
  assigning: boolean;
}) {
  const q = useQuery({
    queryKey: ["direct-referral-suggestions", tripId],
    queryFn: () => suggest(tripId),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Finding eligible providers…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const list = (q.data ?? []) as any[];
  if (list.length === 0) return <p className="text-sm text-muted-foreground">No eligible providers for this trip.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Eligible providers</p>
      <div className="grid gap-2 md:grid-cols-2">
        {list.slice(0, 10).map((p) => (
          <div
            key={p.provider_user_id}
            className="flex items-center justify-between gap-3 bg-card border border-border rounded-sm p-3"
          >
            <div className="min-w-0">
              <div className="font-bold truncate">{p.company_name ?? p.display_id ?? p.provider_user_id.slice(0, 8)}</div>
              <div className="text-xs text-muted-foreground truncate">{p.reason ?? "Eligible"}</div>
            </div>
            <button
              onClick={() => onAssign(p.provider_user_id)}
              disabled={assigning}
              className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-sm bg-primary text-primary-foreground shrink-0"
            >
              Assign
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
