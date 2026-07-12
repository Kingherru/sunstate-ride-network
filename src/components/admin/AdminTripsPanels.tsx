import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAllTripsAdmin, listAllReservationsAdmin } from "@/lib/admin-trips.functions";
import { AdminReservationDetailModal } from "./AdminReservationDetailModal";


const STATUS_OPTIONS = ["all", "pending", "assigned", "in_progress", "completed", "canceled", "no_show"];

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "unknown").replace(/_/g, " ");
  return (
    <span className="inline-flex items-center rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
      {s}
    </span>
  );
}

export function AdminTripsPanel() {
  const fetch = useServerFn(listAllTripsAdmin);
  const [status, setStatus] = useState("all");
  const q = useQuery({
    queryKey: ["admin-trips", status],
    queryFn: () => fetch({ data: { status } }),
  });

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-sm p-4 flex flex-wrap gap-3 items-center">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="border border-border rounded-sm px-3 py-2 bg-background text-sm">
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{q.data?.length ?? 0} trips</span>
      </div>

      <div className="bg-card border border-border rounded-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left p-3">Trip ID</th>
              <th className="text-left p-3">Date / Time</th>
              <th className="text-left p-3">Patient</th>
              <th className="text-left p-3">Pickup</th>
              <th className="text-left p-3">Dropoff</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Cost</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading trips…</td></tr>}
            {q.error && <tr><td colSpan={8} className="p-6 text-center text-destructive">{(q.error as Error).message}</td></tr>}
            {!q.isLoading && (q.data?.length ?? 0) === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No trips found.</td></tr>
            )}
            {q.data?.map((t: any) => (
              <tr key={t.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{t.display_id ?? t.id.slice(0, 8)}</td>
                <td className="p-3">{t.pickup_date} {t.pickup_time?.slice(0,5)}</td>
                <td className="p-3">{t.patient_first_name} {t.patient_last_name}</td>
                <td className="p-3">{t.pickup_city} {t.pickup_zip}</td>
                <td className="p-3">{t.dropoff_city} {t.dropoff_zip ?? ""}</td>
                <td className="p-3 capitalize">{t.transport_type ?? "—"}</td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className="p-3 text-right font-mono">{t.cost_total != null ? `$${Number(t.cost_total).toFixed(2)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminReservationsPanel() {
  const fetch = useServerFn(listAllReservationsAdmin);
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin-reservations", status],
    queryFn: () => fetch({ data: { status } }),
  });


  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-sm p-4 flex flex-wrap gap-3 items-center">
        <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="border border-border rounded-sm px-3 py-2 bg-background text-sm">
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{q.data?.length ?? 0} reservations</span>
      </div>

      <div className="bg-card border border-border rounded-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left p-3">Date / Time</th>
              <th className="text-left p-3">Patient</th>
              <th className="text-left p-3">Pickup</th>
              <th className="text-left p-3">Dropoff</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading reservations…</td></tr>}
            {q.error && <tr><td colSpan={7} className="p-6 text-center text-destructive">{(q.error as Error).message}</td></tr>}
            {!q.isLoading && (q.data?.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No reservations found.</td></tr>
            )}
            {q.data?.map((r: any) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className="border-t border-border cursor-pointer hover:bg-secondary/30"
              >
                <td className="p-3">{r.pickup_date} {r.pickup_time?.slice(0,5)}</td>
                <td className="p-3">{r.patient_first_name} {r.patient_last_name}</td>
                <td className="p-3">{r.pickup_city} {r.pickup_zip}</td>
                <td className="p-3">{r.dropoff_city} {r.dropoff_zip ?? ""}</td>
                <td className="p-3 capitalize">{r.transport_type ?? "—"}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openId && (
        <AdminReservationDetailModal reservationId={openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

