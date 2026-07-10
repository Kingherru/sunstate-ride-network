import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReservationReview } from "@/lib/requests.functions";
import { RoutePreview, googleRouteUrl, formatMinutes } from "@/components/maps/RoutePreview";

export const Route = createFileRoute("/_authenticated/reservations/$id/review")({
  head: () => ({
    meta: [
      { title: "Reservation Review — MyFloridaNemt.com" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReservationReviewPage,
});

function mobilityLabel(r: any): string {
  const t = String(r?.transport_type ?? "").toLowerCase();
  if (t === "stretcher" || String(r?.service_level ?? "").toLowerCase() === "stretcher") return "Stretcher";
  if (t === "wheelchair" || r?.needs_wheelchair) return "Wheelchair";
  return "Ambulatory";
}

function sourceLabel(src: string | null | undefined, hasRequester: boolean) {
  const v = (src ?? (hasRequester ? "provider" : "auto")).toLowerCase();
  if (v === "auto") return "MyFloridaNemt.com Auto Match";
  if (v === "provider") return "Provider Submitted";
  if (v === "facility") return "Facility Submitted";
  return "Patient Submitted";
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-900 border-amber-300",
    accepted: "bg-emerald-100 text-emerald-800 border-emerald-300",
    assigned: "bg-blue-100 text-blue-900 border-blue-300",
    in_progress: "bg-indigo-100 text-indigo-900 border-indigo-300",
    completed: "bg-green-100 text-green-900 border-green-300",
    cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
    canceled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  };
  const cls = map[s] ?? "bg-zinc-100 text-zinc-700 border-zinc-300";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${cls}`}>
      {status || "—"}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground break-words mt-0.5">{children}</div>
    </div>
  );
}

function ReservationReviewPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getReservationReview);

  const q = useQuery({
    queryKey: ["reservation-review", id],
    queryFn: async () => {
      const r = await get({ data: { id } });
      if (!r.ok) throw new Error(r.error);
      return { row: r.row as any, driver: r.driver };
    },
  });

  if (q.isLoading) {
    return <main className="mx-auto max-w-6xl px-4 py-10">Loading…</main>;
  }
  if (q.isError || !q.data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-red-700 mb-2">Could not load that reservation.</p>
        <button onClick={() => navigate({ to: "/provider/dashboard" })} className="text-sm underline">← Back to dashboard</button>
      </main>
    );
  }

  const r = q.data.row;
  const driver = q.data.driver;
  const mob = mobilityLabel(r);
  const isRound = !!r.round_trip;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : navigate({ to: "/provider/dashboard" })}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Reservation Review</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Side-by-side view of the original request and the reservation as it stands today. The original request is preserved for auditing.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <StatusPill status={r.status} />
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {r.patient_first_name} {r.patient_last_name} · {r.pickup_date}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/requests/$id"
            params={{ id: r.id }}
            className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted"
          >
            Open full request page
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ORIGINAL REQUEST */}
        <section className="rounded-sm border border-border bg-card">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">Original Request</h2>
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground">Preserved for audit</span>
          </div>
          <div className="p-5 space-y-4">
            <Field label="Request source">{sourceLabel(r.dispatch_source, !!r.requester_user_id)}</Field>
            <Field label="Submitted at">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</Field>
            <Field label="Original requester">
              {r.requester_user_id ? <span className="font-mono text-xs">{r.requester_user_id.slice(0, 8)}…</span> : <span className="text-muted-foreground">Unknown</span>}
            </Field>
            <Field label="Original pickup address">
              {r.pickup_address}
              {r.pickup_address_details && <div className="italic text-muted-foreground">{r.pickup_address_details}</div>}
              <div className="text-muted-foreground text-xs">{[r.pickup_city, r.pickup_zip].filter(Boolean).join(" ")}</div>
            </Field>
            <Field label="Original dropoff address">
              {r.dropoff_address}
              <div className="text-muted-foreground text-xs">{[r.dropoff_city, r.dropoff_zip].filter(Boolean).join(" ")}</div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Requested pickup time">{r.pickup_time || "—"}</Field>
              <Field label="Appointment time">{r.appointment_time || "—"}</Field>
            </div>
            {isRound && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Return pickup">{r.return_pickup_time || "—"}</Field>
                <Field label="Return drop-off">{r.return_dropoff_time || "—"}</Field>
              </div>
            )}
            <Field label="Requested mobility type">{mob}</Field>
            <Field label="Original mobility notes">
              {r.mobility_notes ? <p className="whitespace-pre-wrap">{r.mobility_notes}</p> : <span className="text-muted-foreground">None</span>}
            </Field>
            <Field label="Original special instructions">
              {r.special_instructions ? <p className="whitespace-pre-wrap">{r.special_instructions}</p> : <span className="text-muted-foreground">None</span>}
            </Field>
          </div>
        </section>

        {/* RESERVATION */}
        <section className="rounded-sm border border-border bg-card">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">Reservation</h2>
            <StatusPill status={r.status} />
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Assigned driver">
                {driver ? (
                  <div>
                    <div>{[driver.first_name, driver.last_name].filter(Boolean).join(" ") || "—"}</div>
                    {driver.phone && <div className="text-xs text-muted-foreground">{driver.phone}</div>}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not yet assigned</span>
                )}
              </Field>
              <Field label="Assigned vehicle">
                <span className="text-muted-foreground">Not tracked yet</span>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Updated pickup time">{r.scheduled_start_time ? String(r.scheduled_start_time).slice(0, 5) : r.pickup_time || "—"}</Field>
              <Field label="Reservation status">{r.status || "—"}</Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Estimated price">
                {r.estimated_cost_cents != null ? `$${(r.estimated_cost_cents / 100).toFixed(2)}` : <span className="text-muted-foreground">—</span>}
              </Field>
              <Field label="Estimated mileage">
                {r.distance_miles != null ? `${Number(r.distance_miles).toFixed(1)} mi` : <span className="text-muted-foreground">—</span>}
              </Field>
            </div>
            <Field label="Route (traffic-adjusted)">
              {r.estimated_duration_traffic_seconds != null
                ? formatMinutes(r.estimated_duration_traffic_seconds)
                : r.estimated_duration_seconds != null
                ? formatMinutes(r.estimated_duration_seconds)
                : <span className="text-muted-foreground">—</span>}
            </Field>
            <div>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">Route preview</div>
              <RoutePreview
                polyline={r.route_polyline}
                pickupLat={r.pickup_lat}
                pickupLng={r.pickup_lng}
                dropoffLat={r.dropoff_lat}
                dropoffLng={r.dropoff_lng}
                height={200}
              />
              <a
                href={googleRouteUrl(
                  r.pickup_lat,
                  r.pickup_lng,
                  r.dropoff_lat,
                  r.dropoff_lng,
                  [r.pickup_address, r.pickup_city, "FL"].filter(Boolean).join(", "),
                  [r.dropoff_address, r.dropoff_city, "FL"].filter(Boolean).join(", "),
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
              >
                Open in Google Maps →
              </a>
            </div>
            <Field label="Provider notes">
              {r.provider_notes ? <p className="whitespace-pre-wrap">{r.provider_notes}</p> : <span className="text-muted-foreground">No notes yet</span>}
            </Field>
            <Field label="Internal dispatch notes">
              {r.cancel_reason ? <p className="whitespace-pre-wrap text-xs">{r.cancel_reason}</p> : <span className="text-muted-foreground">None</span>}
            </Field>
          </div>
        </section>
      </div>
    </main>
  );
}
