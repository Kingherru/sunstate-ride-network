/** One exporter for every portal trip/schedule download (CSV, Excel, PDF).
 *  Callers pass only rows the signed-in user is already authorized to read
 *  and an explicit column list — no card data, secrets or internal notes. */
import { safeCsvCell } from "@/lib/provider-export-rules";

export type ExportFormat = "csv" | "xlsx" | "pdf";
export type ExportColumn<T> = { label: string; value: (row: T) => unknown };

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function exportTable<T>(rows: T[], columns: ExportColumn<T>[], title: string, format: ExportFormat, filename: string) {
  const head = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => { const v = c.value(r); return v == null ? "" : String(v); }));
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf"); const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" }); doc.text(`MY FLORIDA NEMT — ${title}`, 14, 16);
    autoTable(doc, { startY: 24, head: [head], body, styles: { fontSize: 8 } }); doc.save(`${filename}.pdf`);
  } else if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...body]), title.slice(0, 31));
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } else {
    save(new Blob([[head.map(safeCsvCell).join(","), ...body.map((r) => r.map(safeCsvCell).join(","))].join("\r\n")], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
  }
}

export const readableDate = (d?: string | null) => d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "";
