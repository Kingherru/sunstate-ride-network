import jsPDF from "jspdf";

export interface Cms1500Input {
  // Trip / claim
  claim_id: string; // display_id or short id
  service_date: string; // YYYY-MM-DD

  // Patient (CMS 2, 3, 5, 9)
  patient_first_name: string;
  patient_last_name: string;
  patient_middle?: string | null;
  patient_date_of_birth?: string | null;
  patient_gender?: string | null; // M / F / X
  patient_address?: string | null;
  patient_city?: string | null;
  patient_state?: string | null;
  patient_zip?: string | null;
  patient_phone?: string | null;

  // Insurance / payer (CMS 1, 1a, 4, 11)
  payer?: string | null; // e.g., Medicaid / Medicare / Private
  medicaid_number?: string | null; // 1a Insured's ID
  medicaid_plan?: string | null; // 11c insurance plan / program name
  authorization_number?: string | null; // 23 prior authorization

  // Diagnosis (CMS 21)
  diagnosis_code?: string | null; // ICD-10, e.g. Z79.899

  // Provider / facility (CMS 32, 33)
  provider_company?: string | null;
  provider_npi?: string | null;
  provider_address?: string | null;
  provider_city?: string | null;
  provider_state?: string | null;
  provider_zip?: string | null;
  provider_phone?: string | null;

  // Service line (CMS 24)
  service_level?: string | null; // e.g., ambulatory / wheelchair / stretcher
  transport_type?: string | null;
  round_trip?: boolean | null;
  distance_miles?: number | null;
  charge_cents?: number | null;

  // Pickup / drop-off (attached as trip narrative — CMS 19)
  pickup_address?: string | null;
  pickup_city?: string | null;
  pickup_zip?: string | null;
  pickup_time?: string | null;
  dropoff_address?: string | null;
  dropoff_city?: string | null;
  dropoff_zip?: string | null;
  appointment_time?: string | null;
}

// HCPCS mapping for NEMT transportation codes.
function hcpcsForServiceLevel(level?: string | null): string {
  const l = (level || "").toLowerCase();
  if (l.includes("stretcher")) return "A0130"; // Non-emergency transport, wheelchair van (use A0130 as base)
  if (l.includes("wheelchair")) return "A0130"; // Non-emergency wheelchair van
  if (l.includes("ambulance") || l.includes("bls")) return "A0428"; // BLS non-emergency
  if (l.includes("als")) return "A0426"; // ALS non-emergency
  return "A0100"; // Non-emergency transportation, taxi
}

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

export function downloadCms1500(input: Cms1500Input) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = 612;
  const margin = 36;
  let y = 44;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("HEALTH INSURANCE CLAIM FORM", pageW / 2, y, { align: "center" });
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("APPROVED BY NATIONAL UNIFORM CLAIM COMMITTEE (NUCC) — CMS-1500 (02/12)", pageW / 2, y, { align: "center" });
  doc.setTextColor(0);
  y += 6;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  // Claim identifier strip
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Claim ID: ${input.claim_id}`, margin, y);
  doc.text(`Service date: ${input.service_date}`, pageW - margin, y, { align: "right" });
  y += 14;

  const boxed = (label: string, value: string | null | undefined, x: number, w: number, h = 34) => {
    doc.setDrawColor(140);
    doc.rect(x, y, w, h);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text(label.toUpperCase(), x + 4, y + 8);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(value || "", w - 8);
    doc.text(lines, x + 4, y + 20);
  };

  const rowH = 34;
  const colW = (pageW - margin * 2) / 3;

  // Row 1 — 1 / 1a / 4
  boxed("1. Insurance type", (input.payer || "Medicaid").toUpperCase(), margin, colW);
  boxed("1a. Insured's ID number", input.medicaid_number, margin + colW, colW);
  boxed("4. Insured's name", `${input.patient_last_name}, ${input.patient_first_name}`, margin + colW * 2, colW);
  y += rowH;

  // Row 2 — 2 / 3 / 5
  boxed("2. Patient's name (last, first, MI)",
    `${input.patient_last_name}, ${input.patient_first_name}${input.patient_middle ? " " + input.patient_middle : ""}`,
    margin, colW);
  boxed("3. Patient's DOB / Sex",
    `${input.patient_date_of_birth || "—"}   Sex: ${input.patient_gender || "—"}`,
    margin + colW, colW);
  boxed("5. Patient's address",
    [input.patient_address, [input.patient_city, input.patient_state].filter(Boolean).join(", "), input.patient_zip].filter(Boolean).join("\n"),
    margin + colW * 2, colW, rowH + 12);
  y += rowH;

  // Row 3 — 5 phone / 11 / 11c
  boxed("5b. Telephone", input.patient_phone, margin, colW, 22);
  boxed("11. Insured's policy / group", input.medicaid_number, margin + colW, colW, 22);
  // 11c already shown to the right in tall box (patient address). Add plan under it later.
  y += 22;

  boxed("11c. Insurance plan / program name", input.medicaid_plan, margin, colW * 2, 22);
  boxed("23. Prior authorization", input.authorization_number, margin + colW * 2, colW, 22);
  y += 22;

  // Row — 19 additional claim information (trip narrative)
  const narrative = [
    input.pickup_address ? `Pickup: ${input.pickup_address}${input.pickup_city ? ", " + input.pickup_city : ""}${input.pickup_zip ? " " + input.pickup_zip : ""}${input.pickup_time ? " @ " + input.pickup_time : ""}` : "",
    input.dropoff_address ? `Drop-off: ${input.dropoff_address}${input.dropoff_city ? ", " + input.dropoff_city : ""}${input.dropoff_zip ? " " + input.dropoff_zip : ""}${input.appointment_time ? " (appt " + input.appointment_time + ")" : ""}` : "",
    input.round_trip ? "Round trip" : "One-way",
    input.transport_type ? `Transport: ${input.transport_type}` : "",
    input.service_level ? `Service level: ${input.service_level.replace(/_/g, " ")}` : "",
    input.distance_miles != null ? `Loaded miles: ${Number(input.distance_miles).toFixed(1)}` : "",
  ].filter(Boolean).join(" · ");
  boxed("19. Additional claim information (trip narrative)", narrative, margin, pageW - margin * 2, 42);
  y += 42;

  // 21 Diagnosis
  boxed("21. Diagnosis or nature of illness / injury (ICD-10)", input.diagnosis_code, margin, pageW - margin * 2, 26);
  y += 26;

  // 24. Service line table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setDrawColor(140);
  doc.setFillColor(240, 244, 250);
  doc.rect(margin, y, pageW - margin * 2, 18, "FD");
  doc.text("24. SERVICE LINE(S)", margin + 4, y + 12);
  y += 18;

  const cols = [
    { key: "A", label: "A. Date(s) of service", w: 90 },
    { key: "B", label: "B. Place", w: 40 },
    { key: "C", label: "C. EMG", w: 40 },
    { key: "D", label: "D. HCPCS", w: 60 },
    { key: "E", label: "E. Dx", w: 60 },
    { key: "F", label: "F. Charges", w: 70 },
    { key: "G", label: "G. Units (mi)", w: 60 },
    { key: "H", label: "H. NPI", w: 120 },
  ];
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const scale = (pageW - margin * 2) / totalW;
  let x = margin;
  doc.setFontSize(7);
  doc.setTextColor(90);
  cols.forEach((c) => {
    const w = c.w * scale;
    doc.rect(x, y, w, 16);
    doc.text(c.label, x + 3, y + 11);
    x += w;
  });
  y += 16;

  const values: string[] = [
    input.service_date,
    "41", // Place of service — 41 Ambulance-Land
    "N",
    hcpcsForServiceLevel(input.service_level),
    input.diagnosis_code || "A",
    fmtMoney(input.charge_cents),
    input.distance_miles != null ? Number(input.distance_miles).toFixed(1) : "1",
    input.provider_npi || "",
  ];
  x = margin;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0);
  cols.forEach((c, i) => {
    const w = c.w * scale;
    doc.rect(x, y, w, 20);
    const lines = doc.splitTextToSize(values[i] || "", w - 6);
    doc.text(lines, x + 3, y + 13);
    x += w;
  });
  y += 24;

  // Totals + provider
  boxed("28. Total charge", fmtMoney(input.charge_cents), margin, colW, 26);
  boxed("32. Service facility / pickup location",
    [input.pickup_address, [input.pickup_city, input.patient_state, input.pickup_zip].filter(Boolean).join(" ")].filter(Boolean).join("\n"),
    margin + colW, colW, 26);
  boxed("33. Billing provider info & phone",
    [input.provider_company, input.provider_address,
     [input.provider_city, input.provider_state, input.provider_zip].filter(Boolean).join(" "),
     input.provider_phone ? `Tel: ${input.provider_phone}` : "",
     input.provider_npi ? `NPI: ${input.provider_npi}` : ""].filter(Boolean).join("\n"),
    margin + colW * 2, colW, 26);
  y += 30;

  // Signature block
  doc.setDrawColor(140);
  doc.rect(margin, y, (pageW - margin * 2) / 2 - 4, 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text("12. PATIENT / AUTHORIZED PERSON SIGNATURE", margin + 4, y + 10);
  doc.setTextColor(0);
  doc.line(margin + 4, y + 34, margin + (pageW - margin * 2) / 2 - 8, y + 34);
  doc.setFontSize(8);
  doc.text("Signature", margin + 4, y + 42);

  const rx = margin + (pageW - margin * 2) / 2 + 4;
  doc.rect(rx, y, (pageW - margin * 2) / 2 - 4, 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text("31. PHYSICIAN / SUPPLIER SIGNATURE (with degrees or credentials)", rx + 4, y + 10);
  doc.setTextColor(0);
  doc.line(rx + 4, y + 34, rx + (pageW - margin * 2) / 2 - 8, y + 34);
  doc.setFontSize(8);
  doc.text("Signature & date", rx + 4, y + 42);
  y += 52;

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Generated by Florida NEMT — CMS-1500 (02/12) format for medical transportation billing. Verify all data before submission.", pageW / 2, 760, { align: "center" });

  doc.save(`cms1500-${input.claim_id}.pdf`);
}
