import jsPDF from "jspdf";

export interface TripPdfInput {
  id: string;
  trip_number?: string | null;
  patient_first_name: string;
  patient_last_name: string;
  patient_phone?: string | null;
  patient_date_of_birth?: string | null;
  medicaid_number?: string | null;
  medicaid_plan?: string | null;
  authorization_number?: string | null;
  diagnosis_code?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  pickup_address: string;
  pickup_city: string;
  pickup_zip?: string | null;
  pickup_date: string;
  pickup_time: string;
  dropoff_address: string;
  dropoff_city: string;
  dropoff_zip?: string | null;
  transport_type?: string | null;
  service_level?: string | null;
  round_trip?: boolean | null;
  mobility_notes?: string | null;
  special_instructions?: string | null;
  payer?: string | null;
  odometer_start?: number | null;
  odometer_end?: number | null;
  mileage?: number | string | null;
}

export function downloadTripPdf(trip: TripPdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const left = 48;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Florida NEMT — Trip Sheet", left, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Trip ${trip.trip_number || trip.id.slice(0, 8)}`, left, y);
  y += 24;

  doc.setTextColor(0);
  const section = (label: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(60);
    doc.text(label.toUpperCase(), left, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0);
  };
  const row = (label: string, value: string | null | undefined) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, left, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value || "—", 380);
    doc.text(lines, left + 110, y);
    y += 14 * (Array.isArray(lines) ? lines.length : 1) + 4;
  };

  section("Patient");
  row("Name", `${trip.patient_first_name} ${trip.patient_last_name}`);
  row("Date of birth", trip.patient_date_of_birth || "—");
  row("Phone", trip.patient_phone || "—");
  row("Medicaid #", trip.medicaid_number || "—");
  row("Medicaid plan", trip.medicaid_plan || "—");
  row("Authorization #", trip.authorization_number || "—");
  row("Diagnosis code", trip.diagnosis_code || "—");
  row("Emergency contact", [trip.emergency_contact_name, trip.emergency_contact_phone].filter(Boolean).join(" · ") || "—");
  y += 8;

  section("Pickup");
  row("Date / Time", `${trip.pickup_date} at ${trip.pickup_time}`);
  row("Address", `${trip.pickup_address}, ${trip.pickup_city} ${trip.pickup_zip || ""}`.trim());
  y += 8;

  section("Drop-off");
  row("Address", `${trip.dropoff_address}, ${trip.dropoff_city} ${trip.dropoff_zip || ""}`.trim());
  y += 8;

  section("Transport");
  row("Type", trip.transport_type || "ambulatory");
  row("Service level", (trip.service_level || "curb_to_curb").replace(/_/g, " "));
  row("Round trip", trip.round_trip ? "Yes" : "No");
  row("Mobility notes", trip.mobility_notes || "—");
  row("Special", trip.special_instructions || "—");
  row("Payer", trip.payer || "—");
  y += 12;

  section("Trip log (driver completes on completion)");
  row("Odometer start", trip.odometer_start != null ? String(trip.odometer_start) : "________________");
  row("Odometer end", trip.odometer_end != null ? String(trip.odometer_end) : "________________");
  row("Total mileage", trip.mileage != null ? String(trip.mileage) : "________________");
  y += 12;

  // Signature lines
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text("SIGNATURES", left, y);
  y += 18;
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const sigLine = (label: string) => {
    doc.line(left, y, left + 250, y);
    doc.text(label, left, y + 12);
    doc.line(left + 290, y, left + 460, y);
    doc.text("Date", left + 290, y + 12);
    y += 38;
  };
  sigLine("Patient / authorized representative");
  sigLine("Driver");

  y = 760;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Dispatched via Florida NEMT — CMS-style trip log. Retain for billing records.", left, y);

  doc.save(`trip-${trip.trip_number || trip.id.slice(0, 8)}.pdf`);
}

export interface CsvTripRow {
  patient_first_name: string;
  patient_last_name: string;
  patient_phone?: string;
  pickup_address: string;
  pickup_city: string;
  pickup_zip?: string;
  pickup_date: string;
  pickup_time: string;
  dropoff_address: string;
  dropoff_city: string;
  dropoff_zip?: string;
  transport_type?: string;
  round_trip?: boolean | string;
  mobility_notes?: string;
  special_instructions?: string;
  payer?: string;
  trip_number?: string;
}

/** Normalize header → snake_case key. Accepts common dispatch column variants. */
export function normalizeCsvHeader(h: string): string {
  const k = h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const map: Record<string, string> = {
    first_name: "patient_first_name",
    firstname: "patient_first_name",
    patient_first: "patient_first_name",
    last_name: "patient_last_name",
    lastname: "patient_last_name",
    patient_last: "patient_last_name",
    phone: "patient_phone",
    patient_phone_number: "patient_phone",
    pu_address: "pickup_address",
    pickup: "pickup_address",
    pu_city: "pickup_city",
    pu_zip: "pickup_zip",
    pickup_postal: "pickup_zip",
    do_address: "dropoff_address",
    dropoff: "dropoff_address",
    do_city: "dropoff_city",
    do_zip: "dropoff_zip",
    date: "pickup_date",
    pu_date: "pickup_date",
    time: "pickup_time",
    pu_time: "pickup_time",
    transport: "transport_type",
    mode: "transport_type",
    notes: "mobility_notes",
    instructions: "special_instructions",
    trip_id: "trip_number",
    trip: "trip_number",
  };
  return map[k] ?? k;
}
