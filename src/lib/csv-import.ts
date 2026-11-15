/** Browser-safe CSV helpers for the staged request importer. Nothing here
 *  stores data; rows live in memory until the server re-validates them. */
import { rideRequestSchema, deliveryRequestSchema, DELIVERY_CATEGORY_OPTIONS } from "@/lib/request-schemas";

export const CSV_MAX_ROWS = 250;
export const CSV_MAX_BYTES = 512 * 1024;
export type ImportKind = "passenger" | "delivery";

export const PASSENGER_COLUMNS = [
  "patient_first_name", "patient_last_name", "patient_phone", "patient_email",
  "pickup_address", "pickup_city", "pickup_date", "pickup_time", "appointment_time",
  "dropoff_address", "dropoff_city", "service", "mobility_notes", "special_instructions",
  "dropoff_date","dropoff_time","trip_type","return_date","return_pickup_time","return_dropoff_time","passenger_count","wheelchair_positions",
  "pickup_state","dropoff_state","pickup_zip","dropoff_zip","pickup_county","dropoff_county","pickup_timezone","dropoff_timezone",
] as const;
export const DELIVERY_COLUMNS = [
  "contact_first_name", "contact_last_name", "contact_phone", "contact_email",
  "pickup_address", "pickup_city", "dropoff_address", "dropoff_city",
  "requested_date", "requested_time", "delivery_category", "delivery_instructions", "signature_required",
  "pickup_state","dropoff_state","pickup_zip","dropoff_zip","pickup_county","dropoff_county","pickup_timezone","dropoff_timezone",
] as const;
export function columnsFor(kind: ImportKind): readonly string[] {
  return kind === "passenger" ? PASSENGER_COLUMNS : DELIVERY_COLUMNS;
}

export function templateCsv(kind: ImportKind) {
  const cols = columnsFor(kind);
  const d = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const sample = kind === "passenger"
    ? ["Jane", "Example", "555-555-5555", "", "100 Main St", "Orlando", d, "09:30", "10:00", "200 Clinic Ave", "Orlando", "wheelchair", "", ""]
    : ["Sam", "Example", "555-555-5555", "", "100 Supply Rd", "Tampa", "200 Home St", "Tampa", d, "13:00", "medical_supplies", "Leave with front desk", "no"];
  return cols.join(",") + "\n" + sample.map(csvCell).join(",") + "\n";
}

/** RFC-4180-ish parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** Neutralise spreadsheet formulas in downloadable reports. */
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const SERVICE: Record<string, "ambulatory" | "wheelchair" | "gurney"> = {
  ambulatory: "ambulatory", wheelchair: "wheelchair", stretcher: "gurney", gurney: "gurney",
};
const yes = (v: string) => /^(y|yes|true|1)$/i.test(v.trim());

export function mapRow(kind: ImportKind, r: Record<string, string>) {
  const g = (k: string) => (r[k] ?? "").trim();
  const regional={pickupState:g('pickup_state')||undefined,dropoffState:g('dropoff_state')||undefined,pickupZip:g('pickup_zip'),dropoffZip:g('dropoff_zip'),pickupCounty:g('pickup_county'),dropoffCounty:g('dropoff_county'),pickupTimezone:g('pickup_timezone'),dropoffTimezone:g('dropoff_timezone')};
  if (kind === "passenger") {
    return {
      patientFirstName: g("patient_first_name"), patientLastName: g("patient_last_name"),
      ...regional,
      patientPhone: g("patient_phone"), patientEmail: g("patient_email"),
      pickupAddress: g("pickup_address"), pickupCity: g("pickup_city"),
      pickupDate: g("pickup_date"), pickupTime: g("pickup_time"), appointmentTime: g("appointment_time"),
      dropoffAddress: g("dropoff_address"), dropoffCity: g("dropoff_city"),
      transportType: SERVICE[g("service").toLowerCase()] ?? (g("service") as any),
      mobilityNotes: g("mobility_notes"), specialInstructions: g("special_instructions"),
      dropoffDate:g('dropoff_date'),dropoffTime:g('dropoff_time'),tripType:g('trip_type')||'one_way',roundTrip:g('trip_type')==='round_trip',returnDate:g('return_date'),returnPickupTime:g('return_pickup_time'),returnDropoffTime:g('return_dropoff_time'),passengerCount:g('passenger_count')?Number(g('passenger_count')):1,wheelchairPositions:g('wheelchair_positions')?Number(g('wheelchair_positions')):0,
    };
  }
  return {
    requestCategory: "medical_delivery" as const,
    ...regional,
    contactFirstName: g("contact_first_name"), contactLastName: g("contact_last_name"),
    contactPhone: g("contact_phone"), contactEmail: g("contact_email"),
    pickupAddress: g("pickup_address"), pickupCity: g("pickup_city"),
    dropoffAddress: g("dropoff_address"), dropoffCity: g("dropoff_city"),
    requestedDate: g("requested_date"), requestedTime: g("requested_time"),
    deliveryCategory: g("delivery_category").toLowerCase() as any,
    deliveryInstructions: g("delivery_instructions"), signatureRequired: yes(g("signature_required")),
  };
}

export type ValidatedRow = { row: number; ok: boolean; errors: string[]; data: any; key: string; date: string; service: string };

const FIELD_LABEL: Record<string, string> = { transportType: "service (ambulatory, wheelchair or stretcher)", deliveryCategory: `delivery_category (${DELIVERY_CATEGORY_OPTIONS.join(", ")})` };

export function validateRows(kind: ImportKind, header: string[], body: string[][]): ValidatedRow[] {
  const h = header.map((x) => x.trim().toLowerCase());
  const schema = kind === "passenger" ? rideRequestSchema : deliveryRequestSchema;
  const seen = new Map<string, number>();
  return body.map((cells, i) => {
    const rec: Record<string, string> = {};
    h.forEach((col, j) => (rec[col] = cells[j] ?? ""));
    const extra = h.filter((c) => c && !columnsFor(kind).includes(c));
    const mapped = mapRow(kind, rec);
    const p = schema.safeParse(mapped);
    const errors = extra.length ? [`Unknown column(s): ${extra.join(", ")}`] : [];
    if (!p.success) for (const iss of p.error.issues) {
      const f = String(iss.path[0]);
      const col = FIELD_LABEL[f] ?? f.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()).replace(/^transport_type$/, "service");
      const msg = /date/i.test(iss.message) ? "choose a real date within the next 2 years" : /too small|>=/i.test(iss.message) ? "missing or too short" : /email/i.test(iss.message) ? "not a valid email" : /pattern|invalid string|regex/i.test(iss.message) ? "wrong format (use HH:MM)" : "not valid";
      errors.push(`${col}: ${msg}`);
    }
    const m: any = mapped;
    const date = kind === "passenger" ? m.pickupDate : m.requestedDate;
    const key = [kind,date, kind === "passenger" ? m.pickupTime : m.requestedTime, m.pickupAddress,m.pickupState,m.pickupTimezone,m.dropoffAddress,m.dropoffState,m.dropoffTimezone,m.patientFirstName??m.contactFirstName, m.patientLastName ?? m.contactLastName,m.transportType??m.deliveryCategory].join("|").toLowerCase();
    return { row: i + 2, ok: errors.length === 0, errors, data: p.success ? p.data : null, key, date, service: kind === "passenger" ? String(m.transportType) : String(m.deliveryCategory), dup: seen.has(key) ? seen.get(key) : (seen.set(key, i + 2), undefined) } as any;
  });
}

export function errorReport(rows: { row: number; errors: string[] }[]) {
  return "row,problems\n" + rows.filter((r) => r.errors.length).map((r) => `${r.row},${csvCell(r.errors.join("; "))}`).join("\n") + "\n";
}

/** Stable per-file idempotency key (same file → same key → no duplicate import). */
export async function fileKey(text: string, kind: ImportKind) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(kind + "\n" + text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
