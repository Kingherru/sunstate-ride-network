import { Link } from "@tanstack/react-router";
import { DsBadge, type Status } from "@/components/ds/feedback";
import type { RequestDetailRow, RequestListRow } from "@/lib/portal-requests.functions";
import { useRequestDetails } from './request-detail-context';
import { DsButton } from '@/components/ds/controls';
import { detailValue, selectedService, selectedTripType, NOT_AVAILABLE } from '@/lib/request-detail-fields';
import { DetailSection } from './DetailSection';

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
    ready_for_distribution: ['pending', 'Ready for distribution'],
    offers_sent: ['info', 'Offers sent'],
    negotiating: ['pending', 'Negotiating'],
    reserved: ['info', 'Reserved'],
    provider_selected: ['info', 'Provider selected'],
    needs_attention: ['error', 'Needs attention'],
  };
  const [tone, label] = map[s] ?? ["neutral", s ? titleCase(s) : "Unknown"];
  return <DsBadge status={tone}>{label}</DsBadge>;
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function RequestTable({ rows, detailBase, showSource = false }: { rows: RequestListRow[]; detailBase: "/portal/requests" | "/admin/requests"; showSource?: boolean }) {
  const open = useRequestDetails();
  return (
    <>
      {/* Phone: stacked list, no horizontal scrolling */}
      <ul className="divide-y divide-ds-border md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <DsButton variant="ghost" onClick={() => open({ kind: 'request', id: r.id })} className="!block w-full !px-4 !py-4 text-left !normal-case">
              <div className="flex items-start justify-between gap-3">
                <span className="ds-label text-ds-primary">{r.mfn_id ?? `#${shortId(r.id)}`}</span>
                <StatusBadge status={r.network_status || r.status} />
              </div>
              <p className="ds-body mt-1">{categoryLabel(r)}{!isDelivery(r) && ` · ${serviceLabel(r)}`}</p>
              <p className="ds-support mt-0.5">{fmtDateTime(r.created_at)}{showSource && ` · ${sourceLabel(r.submitted_via)}`}</p>
            </DsButton>
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
            <tr key={r.id} tabIndex={0} role="button" aria-label={`Open request ${r.mfn_id || shortId(r.id)}`} onClick={() => open({ kind: 'request', id: r.id })} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open({ kind: 'request', id: r.id }); } }} className="cursor-pointer border-b border-ds-border hover:bg-ds-surface-muted focus-visible:outline-2 focus-visible:outline-ds-focus last:border-0">
              <td className="px-4 py-3">
                <span className="font-semibold text-ds-link">{r.mfn_id ?? `#${shortId(r.id)}`}</span>
              </td>
              <td className="px-4 py-3">{categoryLabel(r)}</td>
              {!showSource && <td className="px-4 py-3">{serviceLabel(r)}</td>}
              <td className="px-4 py-3">{fmtDateTime(r.created_at)}</td>
              {showSource && <td className="px-4 py-3">{sourceLabel(r.submitted_via)}</td>}
              <td className="px-4 py-3"><StatusBadge status={r.network_status || r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0 py-3"><dt className="ds-support font-semibold uppercase">{label}</dt><dd className="ds-body mt-1 break-words">{value ?? NOT_AVAILABLE}</dd></div>;
}

export function RequestDetail({ r, showSource = false }: { r: RequestDetailRow; showSource?: boolean }) {
  const delivery = isDelivery(r);
  const value = (key: string, applicable = true) => detailValue(r, key, applicable);
  const readable = (key: string) => {
    const raw = value(key);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.includes('T') ? fmtDateTime(raw) : new Date(`${raw.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (/^\d{2}:\d{2}/.test(raw)) return new Date(`2000-01-01T${raw}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return raw;
  };
  const round = !delivery && (r.trip_type === 'round_trip' || r.round_trip === true);
  const multi = !delivery && (r.trip_type === 'multi_trip' || r.trip_type === 'multi_stop');
  const repeating = !delivery && !!r.recurrence_rule && r.recurrence_rule !== 'none';
  const stops = Array.isArray(r.additional_stops) ? r.additional_stops as { address?: string; city?: string; pickupTime?: string }[] : [];
  const name = [r.patient_first_name, r.patient_last_name].filter(Boolean).join(' ');
  const fields = 'mt-2 grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3';
  return <div className="space-y-6">
    <DetailSection title="Request identity and status"><dl className={fields}>
      <Row label="Request MFN ID" value={r.mfn_id || NOT_AVAILABLE} />
      <Row label="Transportation service" value={selectedService(r)} />
      <Row label="Trip type" value={selectedTripType(r)} />
      <Row label="Status" value={<StatusBadge status={r.network_status || r.status} />} />
      <Row label="Created" value={r.created_at ? fmtDateTime(r.created_at) : NOT_AVAILABLE} />
      <Row label="Last updated" value={value('last_updated_at') === NOT_AVAILABLE ? readable('updated_at') : readable('last_updated_at')} />
      {showSource && <><Row label="Request source" value={r.submitted_via ? sourceLabel(r.submitted_via) : NOT_AVAILABLE} /><Row label="Intake" value={r.intake_source ? INTAKE[r.intake_source] || r.intake_source : NOT_AVAILABLE} /></>}
    </dl></DetailSection>
    <DetailSection tone="contact" title={delivery ? 'Contact and requester' : 'Passenger and requester'}><dl className={fields}>
      <Row label={delivery ? 'Contact name' : 'Passenger name'} value={name || value('patient_first_name')} />
      <Row label="Phone" value={value('patient_phone')} /><Row label="Email" value={value('patient_email')} />
      <Row label="Requesting person" value={value('requester_name')} /><Row label="Person MFN ID" value={value('requester_mfn_id')} />
      <Row label="Requester phone" value={value('requester_phone')} /><Row label="Requester email" value={value('requester_email')} />
    </dl></DetailSection>
    <DetailSection tone="trip" title={delivery ? 'Pickup and delivery' : 'Locations and times'}><dl className={fields}>
      <Row label="Pickup location" value={value('pickup_address')} /><Row label="Pickup area" value={value('pickup_city')} /><Row label="Pickup ZIP" value={value('pickup_zip')} /><Row label="Pickup location details" value={value('pickup_address_details')} />
      <Row label="Pickup date" value={readable('pickup_date')} /><Row label="Requested pickup time" value={readable('pickup_time')} />
      <Row label={delivery ? 'Delivery destination' : 'Drop-off location'} value={value('dropoff_address')} /><Row label="Destination area" value={value('dropoff_city')} /><Row label="Destination ZIP" value={value('dropoff_zip')} />
      {!delivery && <Row label="Requested drop-off / appointment time" value={readable('appointment_time')} />}
      {round && <><Row label="Return date" value={readable('return_date')} /><Row label="Return pickup time" value={readable('return_pickup_time')} /><Row label="Return drop-off time" value={readable('return_dropoff_time')} /></>}
      {round && <><Row label="Return pickup building" value={value('return_pickup_building')} /><Row label="Return pickup suite" value={value('return_pickup_suite')} /></>}
    </dl>
    {multi && <div className="mt-4"><h3 className="ds-label uppercase">Additional stops</h3>{stops.length ? stops.map((stop, i) => <dl key={i} className={fields}><Row label={`Stop ${i + 1}`} value={stop.address || 'NOT PROVIDED'} /><Row label="City" value={stop.city || 'NOT PROVIDED'} /><Row label="Pickup time" value={stop.pickupTime || 'NOT PROVIDED'} /><Row label="Stop notes" value={NOT_AVAILABLE} /></dl>) : <p className="ds-body">NOT PROVIDED</p>}</div>}
    {repeating && <dl className={fields}><Row label="Recurrence" value={value('recurrence_rule')} /><Row label="Repeats until" value={readable('recurrence_end_date')} /></dl>}
    </DetailSection>
    <DetailSection tone="service" title={delivery ? 'Delivery handling' : 'Transportation requirements'}><dl className={fields}>
      {delivery ? <><Row label="Delivery category" value={DELIVERY_CAT[String(r.delivery_item_type || '')] || value('delivery_item_type')} /><Row label="Signature required" value={value('delivery_signature_required')} /></> : <><Row label="Service level" value={value('service_level')} /><Row label="Wheelchair required" value={value('needs_wheelchair')} /><Row label="Assistance to vehicle" value={value('needs_assistance_to_vehicle')} /><Row label="Mobility notes" value={value('mobility_notes')} /></>}
    </dl></DetailSection>
    <DetailSection tone="notes" title="Notes and special instructions"><dl className={fields}><Row label={delivery ? 'Handling instructions' : 'Additional information'} value={value(delivery ? 'delivery_instructions' : 'special_instructions')} /></dl></DetailSection>
  </div>;
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
