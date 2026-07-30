import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { listReservationsByState } from "@/lib/trips.functions";
import { RESV_DND_MIME } from "@/components/dashboard/ScheduleCalendarPanel";
import { downloadCms1500 } from "@/lib/cms-form";
import { formatMinutes } from "@/components/maps/RoutePreview";
import { ReservationReviewDialog } from "@/components/dashboard/ReservationReviewDialog";


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
  return_date: string | null;
  round_trip: boolean | null;
  trip_type: string | null;
  transport_type: string | null;
  dispatch_source: string | null;
  requester_user_id: string | null;
  service_level: string | null;
  needs_wheelchair: boolean | null;
  distance_miles: number | null;
  estimated_cost_cents: number | null;
  estimated_duration_seconds: number | null;
  estimated_duration_traffic_seconds: number | null;
  payer: string | null;
  is_medicaid: boolean | null;
  created_at?: string | null;
};

function isMedicaidTrip(r: { is_medicaid?: boolean | null; payer?: string | null }) {
  return !!r.is_medicaid || (!!r.payer && r.payer.toLowerCase().includes("medicaid"));
}

function MedicaidBadge() {
  return (
    <span
      title="Medicaid-funded trip — check credentials & authorization before assigning"
      className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm"
    >
      <span aria-hidden>★</span> Medicaid
    </span>
  );
}

function sourceBadge(src: string | null, hasRequester: boolean) {
  const v = (src ?? (hasRequester ? "provider" : "auto")).toLowerCase();
  if (v === "auto")
    return <span className="bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">My Florida NEMT Auto Match</span>;
  if (v === "provider")
    return <span className="bg-accent/15 text-accent text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">Provider Submitted</span>;
  if (v === "facility")
    return <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">Facility Submitted</span>;
  return <span className="bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">Patient Submitted</span>;
}

function mobilityLabel(r: { transport_type?: string | null; needs_wheelchair?: boolean | null; service_level?: string | null }): string {
  const t = (r.transport_type ?? "").toLowerCase();
  if (t === "stretcher" || (r.service_level ?? "").toLowerCase() === "stretcher") return "Stretcher";
  if (t === "wheelchair" || r.needs_wheelchair) return "Wheelchair";
  return "Ambulatory";
}

function fmtRelative(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}


export function RequestsPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();

  // Membership eligibility (item 39): only active paid members receive auto-match / provider-transferred trips.
  const membership = useQuery({
    queryKey: ["my-membership-status", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_profiles")
        .select("membership_status, membership_tier")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });
  const isPaidMember =
    membership.data?.membership_status === "active" && membership.data?.membership_tier === "paid";

  const q = useQuery({
    queryKey: ["incoming-requests", userId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any).rpc("list_open_ride_requests");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  async function approve(id: string) {
    if (!isPaidMember) {
      toast.error("Active paid membership required to accept auto-matched or transferred trips.");
      return;
    }
    const { error } = await supabase
      .from("ride_requests")
      .update({ assigned_provider_id: userId, status: "assigned" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Approved — moved to Booked Reservations");
    qc.invalidateQueries({ queryKey: ["incoming-requests"] });
    qc.invalidateQueries({ queryKey: ["reservations-by-state"] });
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

  const allRows = q.data ?? [];
  // Non-paid members do not receive auto-matched or provider-transferred trips.
  const rows = isPaidMember
    ? allRows
    : allRows.filter((r) => {
        const src = (r.dispatch_source ?? (r.requester_user_id ? "provider" : "auto")).toLowerCase();
        return src !== "auto" && src !== "provider";
      });
  const hiddenForMembership = allRows.length - rows.length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Incoming Requests</h2>
        <p className="text-sm text-muted-foreground">
          Trip requests routed to you by My Florida NEMT (auto by ZIP) or sent directly by another provider/facility. Approve to move into Booked Reservations.
        </p>
      </div>

      {!membership.isLoading && !isPaidMember && (
        <div className="rounded-sm border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-bold uppercase tracking-wider text-xs mb-1">Membership required</div>
          <p>
            Only active paid members receive My Florida NEMT Auto Match and Provider-Submitted trips.
            {hiddenForMembership > 0 && (
              <> You currently have <b>{hiddenForMembership}</b> eligible opportunit{hiddenForMembership === 1 ? "y" : "ies"} in your area.</>
            )}
          </p>
          <Link
            to="/membership"
            className="mt-2 inline-block text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-sm hover:bg-amber-700"
          >
            Upgrade membership
          </Link>
        </div>
      )}

      {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {q.isError && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-4 text-sm text-destructive">
          Reservations could not be loaded. Please try again.
        </div>
      )}
      {!q.isLoading && !q.isError && rows.length === 0 && (
        <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">No open requests right now.</div>
      )}
      <div className="space-y-3">
        {rows.map((r) => {
          const medicaid = isMedicaidTrip(r);
          const mob = mobilityLabel(r);
          const mobStyle =
            mob === "Stretcher"
              ? "bg-red-100 text-red-800"
              : mob === "Wheelchair"
              ? "bg-orange-100 text-orange-700"
              : "bg-slate-100 text-slate-700";
          return (
          <div
            key={r.id}
            className={`rounded-sm p-4 border ${medicaid ? "bg-amber-50 border-amber-300 border-l-4" : "bg-card border-border"}`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {sourceBadge(r.dispatch_source, !!r.requester_user_id)}
                  {medicaid && <MedicaidBadge />}
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${mobStyle}`}>{mob}</span>
                  {r.service_level && <span className="bg-muted text-foreground text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm">{r.service_level.replace(/_/g, " ")}</span>}
                  {r.created_at && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-auto" title={new Date(r.created_at).toLocaleString()}>
                      Requested {fmtRelative(r.created_at)}
                    </span>
                  )}
                </div>
                <div className="font-extrabold">
                  Patient · {r.pickup_date} <span className="text-xs font-normal text-muted-foreground">(details available after you claim)</span>
                </div>
                <div className="text-xs text-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Pickup:</span> {r.pickup_time || "—"}</span>
                  <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Appointment:</span> {r.appointment_time || "—"}</span>
                  {(r.round_trip || r.trip_type === "round_trip" || r.return_pickup_time) && (
                    <>
                      {r.return_date && r.return_date !== r.pickup_date && (
                        <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Return date:</span> {r.return_date}</span>
                      )}
                      <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Return pickup:</span> {r.return_pickup_time || "—"}</span>
                      {r.return_dropoff_time && (
                        <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Return drop-off:</span> {r.return_dropoff_time}</span>
                      )}
                    </>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  <div><span className="font-bold text-foreground">Pickup:</span> {r.pickup_address}{r.pickup_city ? `, ${r.pickup_city}` : ""}{r.pickup_address_details ? ` — ${r.pickup_address_details}` : ""}</div>
                  <div><span className="font-bold text-foreground">Dropoff:</span> {r.dropoff_address}{r.dropoff_city ? `, ${r.dropoff_city}` : ""}</div>
                  {(r.distance_miles != null || r.estimated_cost_cents != null || r.estimated_duration_traffic_seconds != null) && (
                    <div className="mt-1 text-xs flex flex-wrap gap-x-3 gap-y-1">
                      {r.distance_miles != null && <span><span className="font-bold text-foreground">Distance:</span> {Number(r.distance_miles).toFixed(1)} mi</span>}
                      {r.estimated_duration_traffic_seconds != null && (
                        <span>
                          <span className="font-bold text-foreground">ETA (traffic):</span> {formatMinutes(r.estimated_duration_traffic_seconds)}
                          {r.estimated_duration_seconds != null && r.estimated_duration_seconds !== r.estimated_duration_traffic_seconds && (
                            <span className="text-muted-foreground"> · typical {formatMinutes(r.estimated_duration_seconds)}</span>
                          )}
                        </span>
                      )}
                      {r.estimated_cost_cents != null && <span><span className="font-bold text-foreground">Est. fare:</span> ${(r.estimated_cost_cents / 100).toFixed(2)}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to="/requests/$id" params={{ id: r.id }} className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted">View Details</Link>
                <button onClick={() => deny(r.id)} className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted">Deny</button>
                <button
                  onClick={() => approve(r.id)}
                  disabled={!isPaidMember}
                  className="text-xs font-bold bg-accent text-accent-foreground px-3 py-2 rounded-sm hover:bg-accent/90 disabled:opacity-50"
                  title={!isPaidMember ? "Active paid membership required" : "Approve and move to Booked Reservations"}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        );})}
      </div>
    </div>
  );
}


/**
 * Reservations panel — three lifecycle sections:
 *   • Unconfirmed  — newly created, awaiting approval/payment/assignment
 *   • Booked       — confirmed & assigned, still upcoming
 *   • Past         — scheduled time has elapsed but not completed, or canceled
 *
 * Completed trips move straight into Trip History (permanent record).
 * A DB trigger plus a 5-minute recompute keep `reservation_state` in sync —
 * one source of truth shared by the Admin, Dispatch, and Provider portals.
 */
type ResvState = "unconfirmed" | "booked" | "past";
type Scope = "requester" | "provider" | "ops";
type AssignFilter = "all" | "assigned" | "unassigned";

const STATE_META: Record<ResvState, { label: string; blurb: string }> = {
  unconfirmed: {
    label: "Unconfirmed",
    blurb: "Newly created trips waiting on approval, payment, provider assignment, or dispatch review.",
  },
  booked: {
    label: "Booked",
    blurb: "Confirmed and assigned reservations whose pickup time is still ahead.",
  },
  past: {
    label: "Past",
    blurb: "Reservations whose scheduled time has passed but that aren't completed yet, plus canceled trips. Still editable — mark them completed here and they move to Trip History.",
  },
};


export function ReservationsPanel({
  userId,
  scope = "provider",
}: {
  userId: string;
  scope?: Scope;
}) {
  const [state, setState] = useState<ResvState>("unconfirmed");
  const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");
  const [payerFilter, setPayerFilter] = useState<"all" | "medicaid">("all");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<any | null>(null);
  const fn = useServerFn(listReservationsByState);


  // Counts across all three buckets so the tab pill shows totals.
  const counts = useQuery({
    queryKey: ["reservations-by-state", "counts", scope, userId],
    queryFn: async () => {
      const [u, b, p] = await Promise.all([
        fn({ data: { state: "unconfirmed", scope } }),
        fn({ data: { state: "booked", scope } }),
        fn({ data: { state: "past", scope } }),
      ]);
      return { unconfirmed: u.length, booked: b.length, past: p.length };
    },
  });

  const q = useQuery({
    queryKey: ["reservations-by-state", state, scope, userId],
    queryFn: () => fn({ data: { state, scope } }),
  });
  const provider = useQuery({
    queryKey: ["provider-profile-cms", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_profiles")
        .select("company_name, npi, city, phone")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });

  const allRows = (q.data ?? []) as any[];
  const rows = useMemo(() => allRows.filter((r) => {
    if (assignFilter === "assigned" && !r.assigned_driver_id) return false;
    if (assignFilter === "unassigned" && r.assigned_driver_id) return false;
    if (payerFilter === "medicaid" && !isMedicaidTrip(r)) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = `${r.patient_first_name ?? ""} ${r.patient_last_name ?? ""} ${r.pickup_city ?? ""} ${r.dropoff_city ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [allRows, assignFilter, payerFilter, search]);

  const grouped = rows.reduce<Record<string, any[]>>((acc, r) => {
    (acc[r.pickup_date] ||= []).push(r);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) =>
    state === "past" ? b.localeCompare(a) : a.localeCompare(b),
  );

  const meta = STATE_META[state];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Reservations</h2>
        <p className="text-sm text-muted-foreground">
          Create Trip → Unconfirmed → Booked → Past (time elapsed) → Completed (Trip History).
        </p>
      </div>

      {/* Three lifecycle sections */}
      <div className="inline-flex bg-card border border-border rounded-sm p-1 flex-wrap">
        {(["unconfirmed", "booked", "past"] as ResvState[]).map((s) => {
          const c = counts.data?.[s];
          const active = state === s;
          return (
            <button
              key={s}
              onClick={() => setState(s)}
              className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm inline-flex items-center gap-2 ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {STATE_META[s].label}
              {typeof c === "number" && (
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1 py-0.5 rounded-sm text-[10px] font-mono ${
                  active ? "bg-primary-foreground/20" : "bg-muted text-foreground"
                }`}>{c}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{meta.blurb}</p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={assignFilter}
          onChange={(e) => setAssignFilter(e.target.value as AssignFilter)}
          className="text-xs font-bold uppercase tracking-wider bg-card border border-border rounded-sm px-3 py-2"
          aria-label="Filter by driver assignment"
        >
          <option value="all">All driver assignments</option>
          <option value="assigned">Driver assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>

        <select
          value={payerFilter}
          onChange={(e) => setPayerFilter(e.target.value as "all" | "medicaid")}
          className="text-xs font-bold uppercase tracking-wider bg-card border border-border rounded-sm px-3 py-2"
          aria-label="Filter by payer"
        >
          <option value="all">All payers</option>
          <option value="medicaid">Medicaid only</option>
        </select>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patient or city…"
          className="text-xs bg-card border border-border rounded-sm px-3 py-2 min-w-[220px] flex-1"
        />

        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground ml-auto">
          {rows.length} of {allRows.length}
        </div>
      </div>

      {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!q.isLoading && rows.length === 0 && (
        <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">
          {state === "unconfirmed"
            ? "No unconfirmed reservations. New trips will show up here first."
            : state === "booked"
            ? "No booked reservations yet. Confirmed & assigned trips appear here."
            : "Nothing past due. Reservations move here once their pickup time passes, until they're completed."}
        </div>
      )}

      <div className="space-y-6">
        {dates.map((date) => (
          <div key={date}>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
              <span className="ml-2 text-foreground">· {grouped[date].length} trip{grouped[date].length === 1 ? "" : "s"}</span>
            </div>
            <div className="space-y-3">
              {grouped[date].map((r: any) => {
                const medicaid = isMedicaidTrip(r);
                const onDownloadCms = () => {
                  const p = provider.data;
                  downloadCms1500({
                    claim_id: r.id.slice(0, 8),
                    service_date: r.pickup_date,
                    patient_first_name: r.patient_first_name,
                    patient_last_name: r.patient_last_name,
                    patient_date_of_birth: r.patient_date_of_birth,
                    patient_gender: r.patient_gender,
                    patient_phone: r.patient_phone,
                    payer: r.payer,
                    medicaid_number: r.medicaid_number,
                    medicaid_plan: r.medicaid_plan,
                    authorization_number: r.authorization_number,
                    diagnosis_code: r.diagnosis_code,
                    provider_company: p?.company_name,
                    provider_npi: p?.npi,
                    provider_city: p?.city,
                    provider_phone: p?.phone,
                    service_level: r.service_level,
                    transport_type: r.transport_type,
                    round_trip: r.round_trip,
                    distance_miles: r.distance_miles,
                    charge_cents: r.estimated_cost_cents,
                    pickup_address: r.pickup_address,
                    pickup_city: r.pickup_city,
                    pickup_zip: r.pickup_zip,
                    pickup_time: r.pickup_time,
                    dropoff_address: r.dropoff_address,
                    dropoff_city: r.dropoff_city,
                    dropoff_zip: r.dropoff_zip,
                    appointment_time: r.appointment_time,
                  });
                  if (!p) toast.info("CMS form downloaded — add your NPI & business info in Account to auto-fill provider block 33.");
                };
                return (
                <div
                  key={r.id}
                  draggable={state === "booked"}
                  onDragStart={(e) => { if (state === "booked") { e.dataTransfer.setData(RESV_DND_MIME, r.id); e.dataTransfer.effectAllowed = "move"; } }}
                  className={`rounded-sm p-4 flex items-start justify-between gap-3 flex-wrap border ${
                    state === "booked" ? "cursor-grab active:cursor-grabbing" : ""
                  } ${medicaid ? "bg-amber-50 border-amber-300 border-l-4" : "bg-card border-border"}`}
                  title={state === "booked" ? "Drag onto the Schedule tab to (re)assign a driver and time" : undefined}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${
                        state === "unconfirmed" ? "bg-amber-100 text-amber-800"
                        : state === "booked" ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                      }`}>{r.status}</span>
                      {medicaid && <MedicaidBadge />}
                      {r.scheduled_start_time && (
                        <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm">
                          Sched {String(r.scheduled_start_time).slice(0,5)}
                        </span>
                      )}
                      {r.assigned_driver_id ? (
                        <span className="bg-muted text-foreground text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm">Driver assigned</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm">Unassigned</span>
                      )}
                      {state === "booked" && (r as any).priority_offer_accepted_at && (
                        <span
                          className="bg-violet-100 text-violet-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm"
                          title={`Referral accepted ${new Date((r as any).priority_offer_accepted_at).toLocaleString()}`}
                        >
                          Promoted from Referral · {new Date((r as any).priority_offer_accepted_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="font-extrabold">{r.patient_first_name} {r.patient_last_name}</div>
                    <div className="text-xs text-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Pickup:</span> {r.pickup_time || "—"}</span>
                      <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Appointment:</span> {r.appointment_time || "—"}</span>
                      {medicaid && r.medicaid_number && (
                        <span><span className="font-bold uppercase tracking-wide text-muted-foreground">Medicaid #:</span> {r.medicaid_number}</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      <div>{r.pickup_address}{r.pickup_city ? `, ${r.pickup_city}` : ""} → {r.dropoff_address}{r.dropoff_city ? `, ${r.dropoff_city}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button type="button" onClick={() => setReviewing(r)} className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted text-center">Review Reservation</button>
                    {scope !== "requester" && (
                      <button
                        type="button"
                        onClick={onDownloadCms}
                        className="text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-sm hover:bg-primary/90"
                        title="Generate a CMS-1500 claim form pre-filled with trip, patient, and provider data"
                      >
                        Download CMS-1500
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {reviewing && (
        <ReservationReviewDialog
          row={reviewing}
          open={!!reviewing}
          onOpenChange={(v) => { if (!v) setReviewing(null); }}
          canApprove={scope === "provider" || scope === "ops"}
        />
      )}
    </div>
  );
}

