import { Link } from "@tanstack/react-router";
import { DsBadge, type Status } from "@/components/ds/feedback";
import type { RequestDetailRow, RequestListRow } from "@/lib/portal-requests.functions";

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  private_pay: "Private Pay", facility: "Facility", hospital: "Hospital", provider: "Provider",
};

const SERVICE_LABEL: Record<string, string> = { ambulatory: "Ambulatory", wheelchair: "Wheelchair", gurney: "Stretcher" };
const TRIP_TYPE: Record<string, string> = { one_way: "One way", round_trip: "Round trip", multi_trip: "Multi-stop" };
const DELIVERY_CAT: Record<string, string> = { medical_supplies: "Medical supplies", equipment: "Medical equipment", dme: "DME", other: "Other" };
const SOURCE: Record<string, string> = { public_form: "Public form", portal: "Portal", admin: "Admin" };

export const INTAKE: Record<string, string> = { platform_public_intake: "Platform public intake", signed_in_person: "Signed-in person", admin_on_behalf: "Admin on behalf of an account" };
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
export const isDelivery = (r: { trip_kind: string | null; transport_type: string | null }) =>
  r.trip_kind === "medical_delivery" || r.transport_type === "delivery";
export const categoryLabel = (r: RequestListRow) => (isDelivery(r) ? "Medical Delivery" : "Passenger Transportation");
export const serviceLabel = (r: RequestListRow) =>
  isDelivery(r) ? "—" : [SERVICE_LABEL[r.transport_type ?? ""] ?? null, TRIP_TYPE[r.trip_type ?? ""] ?? null].filter(Boolean).join(" · ") || "—";
export const sourceLabel = (s: string | null) => SOURCE[s ?? ""] ?? "Not recorded";

function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
/** Real stored status, shown in plain words. "new" means received, never confirmed. */
export function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  const map: Record<string, [Status, string]> = {
    new: ["pending", "Received — under review"],
    pending: ["pending", "Under review"],
    assigned: ["info", "Assigned"],
    accepted: ["info", "Accepted"],
    in_progress: ["info", "In progress"],
    completed: ["success", "Completed"],
    canceled: ["neutral", "Canceled"],
    cancelled: ["neutral", "Canceled"],
    declined: ["neutral", "Declined"],
  };
  const [tone, label] = map[s] ?? ["neutral", s ? titleCase(s) : "Unknown"];
  return <DsBadge status={tone}>{label}</DsBadge>;
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function RequestTable({ rows, detailBase, showSource = false }: { rows: RequestListRow[]; detailBase: "/portal/requests" | "/admin/requests"; showSource?: boolean }) {
  return (
    <>
      {/* Phone: stacked list, no horizontal scrolling */}
      <ul className="divide-y divide-ds-border md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={`${detailBase}/$id` as "/portal/requests/$id"} params={{ id: r.id }} className="block px-4 py-4 ds-transition hover:bg-ds-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ds-focus">
              <div className="flex items-start justify-between gap-3">
                <span className="ds-label text-ds-primary">{r.mfn_id ?? `#${shortId(r.id)}`}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="ds-body mt-1">{categoryLabel(r)}{!isDelivery(r) && ` · ${serviceLabel(r)}`}</p>
              <p className="ds-support mt-0.5">{fmtDateTime(r.created_at)}{showSource && ` · ${sourceLabel(r.submitted_via)}`}</p>
            </Link>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left md:table">
        <thead className="ds-support uppercase tracking-[0.06em]">
          <tr className="border-b border-ds-border">
            <th scope="col" className="px-4 py-3 font-semibold">Request</th>
            <th scope="col" className="px-4 py-3 font-semibold">Category</th>
            {!showSource && <th scope="col" className="px-4 py-3 font-semibold">Service</th>}
            <th scope="col" className="px-4 py-3 font-semibold">Submitted</th>
            {showSource && <th scope="col" className="px-4 py-3 font-semibold">Source</th>}
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="ds-body">
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-ds-border last:border-0">
              <td className="px-4 py-3">
                <Link to={`${detailBase}/$id` as "/portal/requests/$id"} params={{ id: r.id }} className="font-semibold text-ds-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus rounded-ds-sm">{r.mfn_id ?? `#${shortId(r.id)}`}</Link>
              </td>
              <td className="px-4 py-3">{categoryLabel(r)}</td>
              {!showSource && <td className="px-4 py-3">{serviceLabel(r)}</td>}
              <td className="px-4 py-3">{fmtDateTime(r.created_at)}</td>
              {showSource && <td className="px-4 py-3">{sourceLabel(r.submitted_via)}</td>}
              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === false) return null;
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="ds-support font-semibold uppercase tracking-[0.06em]">{label}</dt>
      <dd className="ds-body break-words">{value}</dd>
    </div>
  );
}

export function RequestDetail({ r, showSource = false }: { r: RequestDetailRow; showSource?: boolean }) {
  const d = isDelivery(r);
  const s = (k: string) => (r[k] == null ? null : String(r[k]));
  const stops = Array.isArray(r.additional_stops) ? (r.additional_stops as { address?: string }[]) : [];
  return (
    <div className="space-y-6">
      <section className="rounded-ds bg-ds-surface p-5 shadow-[var(--ds-shadow)] sm:p-6">
        <h2 className="ds-subheading uppercase text-ds-primary">Request</h2>
        <dl className="mt-2 divide-y divide-ds-border">
          <Row label="Request number" value={r.mfn_id ?? `#${shortId(r.id)}`} />
          <Row label="Category" value={categoryLabel(r)} />
          {!d && <Row label="Service" value={serviceLabel(r)} />}
          {d && <Row label="Delivery category" value={DELIVERY_CAT[s("delivery_item_type") ?? ""] ?? s("delivery_item_type")} />}
          <Row label="Status" value={<StatusBadge status={r.status} />} />
          <Row label="Submitted" value={fmtDateTime(r.created_at)} />
          {showSource && <Row label="Source" value={sourceLabel(r.submitted_via)} />}
          {showSource && <Row label="Intake" value={INTAKE[r.intake_source ?? ""] ?? "Not recorded"} />}
        </dl>
      </section>
      <section className="rounded-ds bg-ds-surface p-5 shadow-[var(--ds-shadow)] sm:p-6">
        <h2 className="ds-subheading uppercase text-ds-primary">{d ? "Pickup and delivery" : "Trip"}</h2>
        <dl className="mt-2 divide-y divide-ds-border">
          <Row label={d ? "Requested date" : "Pickup date"} value={s("pickup_date")} />
          <Row label={d ? "Requested time" : "Pickup time"} value={s("pickup_time")?.slice(0, 5)} />
          {!d && <Row label="Appointment time" value={s("appointment_time")} />}
          <Row label="Pickup" value={[s("pickup_address"), s("pickup_address_details"), s("pickup_city")].filter(Boolean).join(", ")} />
          {stops.length > 0 && <Row label="Additional stops" value={stops.map((x) => x.address).filter(Boolean).join(" → ")} />}
          <Row label={d ? "Delivery destination" : "Drop-off"} value={[s("dropoff_address"), s("dropoff_city")].filter(Boolean).join(", ")} />
          {!d && r.round_trip === true && <Row label="Return" value={[s("return_date"), s("return_pickup_time")].filter(Boolean).join(" ")} />}
          {!d && <Row label="Repeats" value={s("recurrence_rule") ? `${s("recurrence_rule")}${s("recurrence_end_date") ? ` until ${s("recurrence_end_date")}` : ""}` : null} />}
          {d && <Row label="Signature required" value={r.delivery_signature_required ? "Yes" : "No"} />}
        </dl>
      </section>
      <section className="rounded-ds bg-ds-surface p-5 shadow-[var(--ds-shadow)] sm:p-6">
        <h2 className="ds-subheading uppercase text-ds-primary">{d ? "Contact" : "Passenger"}</h2>
        <dl className="mt-2 divide-y divide-ds-border">
          <Row label="Name" value={[s("patient_first_name"), s("patient_last_name")].filter(Boolean).join(" ")} />
          <Row label="Phone" value={s("patient_phone")} />
          <Row label="Email" value={s("patient_email")} />
          {!d && <Row label="Mobility notes" value={s("mobility_notes")} />}
          <Row label="Instructions" value={d ? s("delivery_instructions") : s("special_instructions")} />
        </dl>
      </section>
    </div>
  );
}

export function SafeNotFound({ backTo }: { backTo: "/portal/requests" | "/admin/requests" }) {
  return (
    <div className="rounded-ds bg-ds-surface p-8 text-center shadow-[var(--ds-shadow)]">
      <h1 className="ds-section-title uppercase text-ds-primary">Request not available</h1>
      <p className="ds-body mt-3 text-ds-text-2">This request doesn't exist or you don't have access to it.</p>
      <Link to={backTo} className="ds-button-text mt-6 inline-flex min-h-12 items-center rounded-ds-sm bg-ds-primary px-6 uppercase text-ds-on-primary hover:bg-ds-primary-hover">Back to requests</Link>
    </div>
  );
}
