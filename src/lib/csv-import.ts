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
] as const;
export const DELIVERY_COLUMNS = [
  "contact_first_name", "contact_last_name", "contact_phone", "contact_email",
  "pickup_address", "pickup_city", "dropoff_address", "dropoff_city",
  "requested_date", "requested_time", "delivery_category", "delivery_instructions", "signature_required",
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
  if (kind === "passenger") {
    return {
      patientFirstName: g("patient_first_name"), patientLastName: g("patient_last_name"),
      patientPhone: g("patient_phone"), patientEmail: g("patient_email"),
      pickupAddress: g("pickup_address"), pickupCity: g("pickup_city"),
      pickupDate: g("pickup_date"), pickupTime: g("pickup_time"), appointmentTime: g("appointment_time"),
      dropoffAddress: g("dropoff_address"), dropoffCity: g("dropoff_city"),
      transportType: SERVICE[g("service").toLowerCase()] ?? (g("service") as any),
      mobilityNotes: g("mobility_notes"), specialInstructions: g("special_instructions"),
    };
  }
  return {
    requestCategory: "medical_delivery" as const,
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
    if (!p.success) for (const iss of p.error.issues) errors.push(`${FIELD_LABEL[String(iss.path[0])] ?? iss.path.join(".")}: ${iss.message}`);
    const m: any = mapped;
    const date = kind === "passenger" ? m.pickupDate : m.requestedDate;
    const key = [date, kind === "passenger" ? m.pickupTime : m.requestedTime, m.pickupAddress, m.patientLastName ?? m.contactLastName].join("|").toLowerCase();
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
