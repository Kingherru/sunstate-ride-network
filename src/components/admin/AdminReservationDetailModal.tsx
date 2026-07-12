import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getAdminReservation,
  suggestProvidersForReservation,
  pushReservationToProvider,
} from "@/lib/admin-trips.functions";

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

export function AdminReservationDetailModal({
  reservationId,
  onClose,
}: {
  reservationId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fetchReservation = useServerFn(getAdminReservation);
  const fetchProviders = useServerFn(suggestProvidersForReservation);
  const pushFn = useServerFn(pushReservationToProvider);

  const [pushingTo, setPushingTo] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const rq = useQuery({
    queryKey: ["admin-reservation", reservationId],
    queryFn: () => fetchReservation({ data: { id: reservationId } }),
  });

  const pq = useQuery({
    queryKey: ["admin-reservation-providers", reservationId],
    queryFn: () => fetchProviders({ data: { id: reservationId } }),
  });

  const pushMut = useMutation({
    mutationFn: (provider_user_id: string) =>
      pushFn({ data: { reservation_id: reservationId, provider_user_id } }),
    onMutate: (id) => setPushingTo(id),
    onSuccess: () => {
      setFlash("Trip pushed to provider ✓");
      qc.invalidateQueries({ queryKey: ["admin-reservations"] });
      qc.invalidateQueries({ queryKey: ["admin-reservation", reservationId] });
      setTimeout(() => setFlash(null), 2500);
    },
    onError: (e: any) => setFlash(`Error: ${e?.message ?? "push failed"}`),
    onSettled: () => setPushingTo(null),
  });

  const r: any = rq.data;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="bg-background border border-border rounded-sm w-full max-w-4xl my-8"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold uppercase tracking-wide">Reservation Details</h2>
          <button onClick={onClose} className="text-2xl leading-none px-2 hover:opacity-70">×</button>
        </div>

        {rq.isLoading && <div className="p-8 text-center text-muted-foreground">Loading…</div>}
        {rq.error && <div className="p-8 text-center text-destructive">{(rq.error as Error).message}</div>}

        {r && (
          <div className="p-6 space-y-6">
            {flash && (
              <div className="rounded-sm border border-border bg-secondary/40 p-3 text-sm">{flash}</div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Status" value={<span className="uppercase text-xs font-bold">{(r.status ?? "—").replace(/_/g, " ")}</span>} />
              <Field label="Date" value={r.pickup_date} />
              <Field label="Time" value={String(r.pickup_time ?? "").slice(0, 5)} />
              <Field label="Type" value={r.transport_type} />
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-2 text-muted-foreground">Passenger</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Name" value={`${r.patient_first_name ?? ""} ${r.patient_last_name ?? ""}`.trim()} />
                <Field label="Phone" value={r.patient_phone} />
                <Field label="Email" value={r.patient_email} />
                <Field label="Mobility" value={r.mobility_notes} />
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-2 text-muted-foreground">Pickup</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Address" value={r.pickup_address} />
                <Field label="City" value={r.pickup_city} />
                <Field label="ZIP" value={r.pickup_zip} />
              </div>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-2 text-muted-foreground">Dropoff</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Address" value={r.dropoff_address} />
                <Field label="City" value={r.dropoff_city} />
                <Field label="ZIP" value={r.dropoff_zip} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Distance (mi)" value={r.distance_miles} />
              <Field label="Est. Cost" value={r.estimated_cost_cents != null ? `$${(r.estimated_cost_cents / 100).toFixed(2)}` : null} />
              <Field label="Trip Type" value={r.trip_type} />
              <Field label="Round Trip" value={r.round_trip ? "Yes" : "No"} />
            </div>

            {(r.special_instructions || r.provider_notes) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Special Instructions" value={r.special_instructions} />
                <Field label="Provider Notes" value={r.provider_notes} />
              </div>
            )}

            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wide">Push to Provider</h3>
                {r.assigned_provider_id && (
                  <span className="text-xs text-muted-foreground">
                    Currently assigned: <span className="font-mono">{r.assigned_provider_id.slice(0, 8)}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Nearby active providers based on pickup ZIP {r.pickup_zip} / city {r.pickup_city}.
              </p>

              <div className="border border-border rounded-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Provider</th>
                      <th className="text-left p-3">City</th>
                      <th className="text-left p-3">Phone</th>
                      <th className="text-left p-3">Match</th>
                      <th className="text-right p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pq.isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Finding providers…</td></tr>}
                    {pq.error && <tr><td colSpan={5} className="p-6 text-center text-destructive">{(pq.error as Error).message}</td></tr>}
                    {!pq.isLoading && (pq.data?.length ?? 0) === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No active providers found.</td></tr>
                    )}
                    {pq.data?.map((p: any) => (
                      <tr key={p.user_id} className="border-t border-border">
                        <td className="p-3">
                          <div className="font-medium">{p.company_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{p.display_id ?? p.user_id.slice(0, 8)}</div>
                        </td>
                        <td className="p-3">{p.city ?? "—"} {p.state ?? ""}</td>
                        <td className="p-3">{p.phone ?? "—"}</td>
                        <td className="p-3 text-xs">{p.reason}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => pushMut.mutate(p.user_id)}
                            disabled={pushingTo === p.user_id || pushMut.isPending}
                            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
                          >
                            {pushingTo === p.user_id ? "Pushing…" : "Push Trip"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
