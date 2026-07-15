import jsPDF from "jspdf";

export interface DriverEarningsPdfInput {
  driverName: string;
  driverEmail?: string | null;
  periodLabel: string;
  siteName?: string;
  senderName?: string | null;
  senderNote?: string | null;
  trips: {
    completed_count: number;
    canceled_count: number;
    total_miles: number;
    pickup_legs: number;
    wait_minutes: number;
    worked_hours: number;
    worked_days: number;
  };
  lines: Array<{ label: string; amount_cents: number }>;
  gross_cents: number;
  adjustments_cents: number;
  amount_paid_cents: number;
  outstanding_cents: number;
}

function usd(cents: number): string {
  return (Number(cents ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function buildDriverEarningsPdf(input: DriverEarningsPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const left = 48;
  const right = 564;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${input.siteName ?? "My Florida NEMT"} — Earnings statement`, left, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`Driver: ${input.driverName}${input.driverEmail ? ` · ${input.driverEmail}` : ""}`, left, y);
  y += 14;
  doc.text(`Period: ${input.periodLabel}`, left, y);
  y += 14;
  doc.text(`Generated: ${new Date().toLocaleString()}`, left, y);
  y += 20;
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
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, left, y);
    doc.text(value, right, y, { align: "right" });
    y += 16;
  };

  section("Trip activity");
  row("Completed trips", String(input.trips.completed_count));
  row("Pickup legs", String(input.trips.pickup_legs));
  row("Total miles", input.trips.total_miles.toFixed(1));
  row("Wait time (minutes)", String(input.trips.wait_minutes));
  row("Cancellations", String(input.trips.canceled_count));
  row("Hours worked", input.trips.worked_hours.toFixed(2));
  row("Days worked", String(input.trips.worked_days));
  y += 6;

  section("Gross earnings");
  if (input.lines.length === 0) {
    doc.setTextColor(120);
    doc.text("No earnings in this range.", left, y);
    doc.setTextColor(0);
    y += 16;
  } else {
    for (const l of input.lines) row(l.label, usd(l.amount_cents));
  }
  y += 4;
  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 14;
  row("Gross", usd(input.gross_cents), true);
  row("Adjustments", usd(input.adjustments_cents));
  row("Amount paid", `− ${usd(input.amount_paid_cents)}`);
  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 14;
  row("Remaining balance owed", usd(input.outstanding_cents), true);

  if (input.senderNote) {
    y += 10;
    section("Note from provider");
    const lines = doc.splitTextToSize(input.senderNote, right - left);
    doc.text(lines, left, y);
    y += 14 * (Array.isArray(lines) ? lines.length : 1);
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `${input.siteName ?? "My Florida NEMT"} — Retain this statement for your records.`,
    left,
    760,
  );

  return doc;
}

export function downloadDriverEarningsPdf(input: DriverEarningsPdfInput, filename?: string) {
  const doc = buildDriverEarningsPdf(input);
  doc.save(filename ?? `earnings-${input.driverName.replace(/\s+/g, "-")}.pdf`);
}

export function driverEarningsPdfBlobUrl(input: DriverEarningsPdfInput): string {
  const doc = buildDriverEarningsPdf(input);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}
