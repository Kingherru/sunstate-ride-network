import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

type Row = {
  id: string;
  status: string;
  pickup_address: string;
  pickup_address_details?: string | null;
  pickup_city: string | null;
  dropoff_address: string;
  dropoff_city: string | null;
  pickup_date: string;
  pickup_time: string;
  appointment_time: string | null;
  return_pickup_time: string | null;
  return_dropoff_time: string | null;
  round_trip: boolean | null;
  trip_type: string | null;
  transport_type: string | null;
  patient_first_name: string;
  patient_last_name: string;
  dispatch_source: string | null;
  requester_user_id: string | null;
  service_level: string | null;
  needs_wheelchair: boolean | null;
  distance_miles: number | null;
  estimated_cost_cents: number | null;

};

function sourceBadge(src: string | null, hasRequester: boolean) {
  const v = (src ?? (hasRequester ? "provider" : "auto")).toLowerCase();
  if (v === "auto")
    return <span className="bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">Florida NEMT auto-route</span>;
  if (v === "provider")
    return <span className="bg-accent/15 text-accent text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">From provider</span>;
  if (v === "facility")
    return <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">From facility</span>;
  return <span className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">From patient</span>;
}

export function RequestsPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["incoming-requests", userId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("ride_requests")
        .select("id,status,pickup_address,pickup_city,dropoff_address,dropoff_city,pickup_date,pickup_time,appointment_time,return_pickup_time,return_dropoff_time,round_trip,trip_type,transport_type,patient_first_name,patient_last_name,dispatch_source,requester_user_id,service_level,needs_wheelchair,distance_miles,estimated_cost_cents")
        .is("assigned_provider_id", null)
        .in("status", ["pending", "open", "new"])
        .order("pickup_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  async function approve(id: string) {
    const { error } = await supabase
      .from("ride_requests")
      .update({ assigned_provider_id: userId, status: "assigned" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Approved — moved to Reservations");
    qc.invalidateQueries({ queryKey: ["incoming-requests"] });
    qc.invalidateQueries({ queryKey: ["reservations"] });
  }
  async function deny(id: string) {
    const { error } = await supabase
      .from("ride_requests")
      .update({ status: "denied", cancel_reason: "Provider declined" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Request denied");
    qc.invalidateQueries({ queryKey: ["incoming-requests"] });
  }

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Incoming Requests</h2>
        <p className="text-sm text-muted-foreground">
          Trip requests routed to you by Florida NEMT (auto by ZIP) or sent directly by another provider/facility. Approve to move to Reservations.
        </p>
      </div>
      {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!q.isLoading && rows.length === 0 && (
        <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">No open requests right now.</div>
      )}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-sm p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {sourceBadge(r.dispatch_source, !!r.requester_user_id)}
                  {r.needs_wheelchair && <span className="bg-orange-100 text-orange-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm">Wheelchair</span>}
                  {r.service_level && <span className="bg-muted text-foreground text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm">{r.service_level.replace(/_/g, " ")}</span>}
                </div>
                <div className="font-extrabold">
                  {r.patient_first_name} {r.patient_last_name} · {r.pickup_date}
                </div>
                <div className="text-xs text-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Pickup:</span> {r.pickup_time || "—"}</span>
                  <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Appointment:</span> {r.appointment_time || "—"}</span>
                  {(r.round_trip || r.trip_type === "round_trip" || r.return_pickup_time) && (
                    <>
                      <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Return pickup:</span> {r.return_pickup_time || "—"}</span>
                      {r.return_dropoff_time && (
                        <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Return drop-off:</span> {r.return_dropoff_time}</span>
                      )}
                    </>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">

                  <div><span className="font-bold text-foreground">Pickup:</span> {r.pickup_address}{r.pickup_city ? `, ${r.pickup_city}` : ""}</div>
                  <div><span className="font-bold text-foreground">Dropoff:</span> {r.dropoff_address}{r.dropoff_city ? `, ${r.dropoff_city}` : ""}</div>
                  {(r.distance_miles != null || r.estimated_cost_cents != null) && (
                    <div className="mt-1 text-xs">
                      {r.distance_miles != null && <span className="mr-3"><span className="font-bold text-foreground">Distance:</span> {Number(r.distance_miles).toFixed(1)} mi</span>}
                      {r.estimated_cost_cents != null && <span><span className="font-bold text-foreground">Est. fare:</span> ${(r.estimated_cost_cents / 100).toFixed(2)}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to="/requests/$id" params={{ id: r.id }} className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted">Review</Link>
                <button onClick={() => deny(r.id)} className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted">Deny</button>
                <button onClick={() => approve(r.id)} className="text-xs font-bold bg-accent text-accent-foreground px-3 py-2 rounded-sm hover:bg-accent/90">Approve</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReservationsPanel({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["reservations", userId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("ride_requests")
        .select("id,status,pickup_address,pickup_city,dropoff_address,dropoff_city,pickup_date,pickup_time,appointment_time,return_pickup_time,return_dropoff_time,round_trip,trip_type,transport_type,patient_first_name,patient_last_name,dispatch_source,requester_user_id,service_level,needs_wheelchair,distance_miles,estimated_cost_cents")
        .eq("assigned_provider_id", userId)
        .order("pickup_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const rows = q.data ?? [];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Reservations</h2>
        <p className="text-sm text-muted-foreground">Approved trips assigned to you. Click Review to see full request & trip details.</p>
      </div>
      {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!q.isLoading && rows.length === 0 && (
        <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">No reservations yet. Approve a request to see it here.</div>
      )}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-sm p-4 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {sourceBadge(r.dispatch_source, !!r.requester_user_id)}
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm">{r.status}</span>
              </div>
              <div className="font-extrabold">{r.patient_first_name} {r.patient_last_name} · {r.pickup_date}</div>
              <div className="text-xs text-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Pickup:</span> {r.pickup_time || "—"}</span>
                <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Appointment:</span> {r.appointment_time || "—"}</span>
                {(r.round_trip || r.trip_type === "round_trip" || r.return_pickup_time) && (
                  <>
                    <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Return pickup:</span> {r.return_pickup_time || "—"}</span>
                    {r.return_dropoff_time && (
                      <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Return drop-off:</span> {r.return_dropoff_time}</span>
                    )}
                  </>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                <div>{r.pickup_address}{r.pickup_city ? `, ${r.pickup_city}` : ""} → {r.dropoff_address}{r.dropoff_city ? `, ${r.dropoff_city}` : ""}</div>
              </div>

            </div>
            <Link to="/requests/$id" params={{ id: r.id }} className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted shrink-0">Review</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
