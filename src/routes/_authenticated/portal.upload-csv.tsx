import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { CSV_MAX_ROWS, errorReport, parseCsv, templateCsv, validateRows, csvCell, type ImportKind, type ValidatedRow } from "@/lib/csv-import";
import { createImportDrafts, getUploadOriginalUrl, listMyUploads, prepareUpload } from "@/lib/uploads.functions";
import { parseNoteShortcodes } from "@/lib/note-shortcodes";
import { supabase } from "@/integrations/supabase/client";
import { usePortalPreview, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";

export const Route = createFileRoute("/_authenticated/portal/upload-csv")({
  head: () => ({ meta: [{ title: "Uploads — MY FLORIDA NEMT" }, { name: "description", content: "Upload CSV, Excel or PDF files to create editable trip drafts for review in your MY FLORIDA NEMT account." }, { property: "og:title", content: "Uploads — MY FLORIDA NEMT" }, { property: "og:description", content: "Turn CSV, Excel or PDF files into editable trip drafts." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalUploads,
});

const MAX_TABLE_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
type Src = "csv" | "xlsx" | "pdf";
type Row = ValidatedRow & { dup?: number };
type PdfReview = { fields: { label: string; value: string }[]; payload: Record<string, unknown>; unresolved: string[] };

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
async function sha256(buf: ArrayBuffer, salt: string) {
  const joined = new Uint8Array([...new TextEncoder().encode(salt + "\n"), ...new Uint8Array(buf)]);
  const d = await crypto.subtle.digest("SHA-256", joined);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function pdfText(buf: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    lines.push(c.items.map((x: any) => ("str" in x ? x.str + (x.hasEOL ? "\n" : " ") : "")).join(""));
  }
  return lines.join("\n");
}

function PortalUploads() {
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const prepare = useServerFn(prepareUpload);
  const create = useServerFn(createImportDrafts);
  const listFn = useServerFn(listMyUploads);
  const originalUrl = useServerFn(getUploadOriginalUrl);
  const history = usePortalQuery({ queryKey: ["my-uploads"], queryFn: () => listFn() });
  const [kind, setKind] = useState<ImportKind>("passenger");
  const [file, setFile] = useState<{ f: File; src: Src; key: string; buf: ArrayBuffer } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [pdf, setPdf] = useState<PdfReview | null>(null);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ created: number; failed: number; duplicateFile: boolean } | null>(null);

  function reset() { setFile(null); setRows(null); setPdf(null); setDone(null); setFileError(""); setChosen(new Set()); }

  async function onFile(f: File | undefined) {
    reset();
    if (!f) return;
    const src: Src | null = /\.csv$/i.test(f.name) ? "csv" : /\.xlsx$/i.test(f.name) ? "xlsx" : /\.pdf$/i.test(f.name) ? "pdf" : null;
    if (!src) return setFileError("Choose a .csv, .xlsx or .pdf file.");
    if (f.size > (src === "pdf" ? MAX_PDF_BYTES : MAX_TABLE_BYTES)) return setFileError(src === "pdf" ? "PDF files can be up to 10 MB." : "Spreadsheets can be up to 2 MB.");
    try {
      const buf = await f.arrayBuffer();
      const key = await sha256(buf, `${kind}:${src}`);
      if (src === "pdf") {
        const text = await pdfText(buf);
        if (!text.trim()) return setFileError("No readable text was found in that PDF. Scanned images can't be read yet.");
        const parsed = parseNoteShortcodes(text);
        const fields = Object.entries(parsed.payload).filter(([, v]) => v !== "" && v != null && typeof v !== "object").map(([k, v]) => ({ label: k.replace(/([A-Z])/g, " $1").toLowerCase(), value: String(v) }));
        setPdf({ fields, payload: parsed.payload, unresolved: [...parsed.unreadable, ...parsed.held].slice(0, 40) });
      } else {
        let table: string[][];
        if (src === "csv") {
          const text = new TextDecoder().decode(buf);
          if (/[\u0000-\u0008]/.test(text.slice(0, 2000))) return setFileError("That file isn't a plain-text CSV.");
          table = parseCsv(text);
        } else {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(buf, { type: "array", cellDates: false });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          table = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][]).map((r) => r.map((c) => String(c ?? ""))).filter((r) => r.some((c) => c.trim()));
        }
        if (table.length < 2) return setFileError("The file has no data rows.");
        if (table.length - 1 > CSV_MAX_ROWS) return setFileError(`Up to ${CSV_MAX_ROWS} rows per upload.`);
        const v = validateRows(kind, table[0], table.slice(1)) as Row[];
        setRows(v);
        setChosen(new Set(v.filter((r) => r.ok && r.dup === undefined).map((r) => r.row)));
      }
      setFile({ f, src, key, buf });
    } catch { setFileError("That file couldn't be read. Check the format and try again."); }
  }

  async function storeOriginal(): Promise<string | null> {
    if (!file) return null;
    const p = await prepare({ data: { sourceType: file.src, sourceHash: file.key, byteSize: file.f.size } });
    const { error } = await supabase.storage.from("import-uploads").uploadToSignedUrl(p.path, p.token, file.f);
    if (error) throw new Error("The original file couldn't be stored. Please try again.");
    return p.uploadId;
  }

  async function onCreate() {
    if (preview.active) return previewBlocked();
    if (!file) return;
    setBusy(true);
    try {
      const uploadId = await storeOriginal();
      const picked = file.src === "pdf"
        ? [{ row: 1, data: { ...pdf!.payload, ...(kind === "delivery" ? { requestCategory: "medical_delivery" } : {}) } }]
        : (rows ?? []).filter((r) => chosen.has(r.row) && r.ok).map((r) => ({ row: r.row, data: r.data }));
      const problems = (rows ?? []).filter((r) => !r.ok || r.dup !== undefined).map((r) => ({ row: r.row, problems: r.ok ? [`Possible duplicate of row ${r.dup}`] : r.errors.slice(0, 20).map((e) => e.slice(0, 200)) }));
      const res = await create({ data: { kind, sourceType: file.src, idempotencyKey: file.key, uploadId, rows: picked, problems } });
      setDone(res);
      if (res.duplicateFile) toast.message("This file was already uploaded, so no new drafts were created.");
      qc.invalidateQueries({ queryKey: ["my-uploads"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function openOriginal(id: string) {
    const w = window.open("", "_blank");
    const r = await originalUrl({ data: { uploadId: id } });
    if ("url" in r && r.url) { if (w) w.location.href = r.url; } else { w?.close(); toast.error(("error" in r && r.error) || "Unavailable."); }
  }

  const valid = rows?.filter((r) => r.ok && r.dup === undefined) ?? [];
  const invalid = rows?.filter((r) => !r.ok) ?? [];
  const dups = rows?.filter((r) => r.dup !== undefined) ?? [];
  const selectedCount = rows ? [...chosen].filter((n) => valid.some((r) => r.row === n)).length : pdf ? 1 : 0;
  const h = history.data as Awaited<ReturnType<typeof listMyUploads>> | undefined;

  return (
    <>
      <PageHead title="Uploads">Turn a CSV, Excel or PDF file into editable trip drafts. Nothing is submitted, sent to a provider or charged — you review each draft first.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <fieldset>
          <legend className="portal-label">1. Request type</legend>
          <div className="flex flex-wrap gap-4">
            {(["passenger", "delivery"] as const).map((k) => (
              <label key={k} className="ds-body flex items-center gap-2"><input type="radio" name="kind" checked={kind === k} onChange={() => { setKind(k); reset(); }} />{k === "passenger" ? "Passenger transportation" : "Medical Delivery"}</label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4"><button onClick={() => download(`mfn-${kind}-template.csv`, templateCsv(kind))} className="portal-btn-secondary whitespace-nowrap">Download CSV template</button></div>
        <div className="mt-4">
          <label htmlFor="upload-file" className="portal-label">2. Choose a file (CSV or Excel up to {CSV_MAX_ROWS} rows, or a PDF)</label>
          <input id="upload-file" type="file" accept=".csv,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => onFile(e.target.files?.[0])} className="ds-body block max-w-full" aria-describedby={fileError ? "up-err" : "up-note"} />
          <p id="up-note" className="ds-support mt-2 text-ds-text-2">Original files are kept privately for 7 days, then deleted. Your drafts stay.</p>
          {fileError && <p id="up-err" role="alert" className="ds-support mt-2 font-semibold text-ds-error">{fileError}</p>}
        </div>
      </section>

      {rows && !done && (
        <section className="mt-6 rounded-ds border border-ds-sky-border bg-ds-sky p-4 sm:p-6" aria-labelledby="up-prev">
          <h2 id="up-prev" className="ds-subheading uppercase text-ds-primary">3. Review rows</h2>
          <ul className="ds-body mt-2 grid gap-1 sm:grid-cols-2">
            <li>Total rows: <strong>{rows.length}</strong></li>
            <li>Ready: <strong>{valid.length}</strong></li>
            <li>Rows with problems: <strong>{invalid.length}</strong></li>
            <li>Possible duplicates (skipped): <strong>{dups.length}</strong></li>
          </ul>
          <div className="mt-4 max-h-80 overflow-auto rounded-ds-sm border border-ds-border bg-ds-surface">
            <table className="ds-support w-full text-left">
              <thead><tr className="border-b border-ds-border"><th className="p-2">Create</th><th className="p-2">Row</th><th className="p-2">Date</th><th className="p-2">Service</th><th className="p-2">Status</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.row} className="border-b border-ds-border last:border-b-0">
                <td className="p-2"><input type="checkbox" aria-label={`Create draft from row ${r.row}`} disabled={!r.ok || r.dup !== undefined} checked={chosen.has(r.row)} onChange={(e) => { const n = new Set(chosen); e.target.checked ? n.add(r.row) : n.delete(r.row); setChosen(n); }} /></td>
                <td className="p-2">{r.row}</td><td className="p-2">{r.date || "—"}</td><td className="p-2">{r.service || "—"}</td>
                <td className="p-2">{!r.ok ? <span className="text-ds-error">{r.errors.join("; ")}</span> : r.dup !== undefined ? `Possible duplicate of row ${r.dup}` : "Ready"}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {(invalid.length > 0 || dups.length > 0) && <button className="portal-btn-secondary mt-3 whitespace-nowrap" onClick={() => download("mfn-upload-errors.csv", errorReport([...invalid, ...dups.map((r) => ({ row: r.row, errors: [`Possible duplicate of row ${r.dup}`] }))]))}>Download error report</button>}
          <button disabled={selectedCount === 0 || busy} onClick={onCreate} className="portal-btn-primary ml-0 mt-4 block whitespace-nowrap sm:inline-block">{busy ? "Creating drafts…" : `Create ${selectedCount} draft${selectedCount === 1 ? "" : "s"}`}</button>
        </section>
      )}

      {pdf && !done && (
        <section className="mt-6 rounded-ds border border-ds-sky-border bg-ds-sky p-4 sm:p-6" aria-labelledby="pdf-prev">
          <h2 id="pdf-prev" className="ds-subheading uppercase text-ds-primary">3. Review what we found</h2>
          <p className="ds-support mt-1 text-ds-text-2">Only clearly labeled details are filled in. Anything missing stays blank for you to complete in the draft.</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="rounded-ds-sm border border-ds-border bg-ds-surface p-3"><h3 className="ds-label text-ds-primary">Found fields</h3>
              {pdf.fields.length ? <dl className="ds-support mt-2 space-y-1">{pdf.fields.map((f) => <div key={f.label} className="flex gap-2"><dt className="font-semibold capitalize">{f.label}:</dt><dd className="break-words">{f.value}</dd></div>)}</dl> : <p className="ds-support mt-2">No labeled trip details were found.</p>}</div>
            <div className="rounded-ds-sm border border-ds-accent/30 bg-ds-accent-soft p-3"><h3 className="ds-label text-ds-primary">Not placed — review manually</h3>
              {pdf.unresolved.length ? <ul className="ds-support mt-2 max-h-48 space-y-1 overflow-y-auto">{pdf.unresolved.map((t, i) => <li key={i} className="break-words">{t}</li>)}</ul> : <p className="ds-support mt-2">Nothing left over.</p>}</div>
          </div>
          <button disabled={busy} onClick={onCreate} className="portal-btn-primary mt-4 whitespace-nowrap">{busy ? "Creating draft…" : "Create 1 draft for review"}</button>
        </section>
      )}

      {done && (
        <section className={`${panelCls} mt-6 p-4 sm:p-6`} aria-live="polite">
          <h2 className="ds-subheading uppercase text-ds-primary">Drafts ready</h2>
          <p className="ds-body mt-2">{done.duplicateFile ? "This exact file was already uploaded — no new drafts were created." : `${done.created} draft${done.created === 1 ? "" : "s"} created${done.failed ? `, ${done.failed} could not be saved` : ""}. Nothing was submitted.`}</p>
          <div className="mt-3 flex flex-wrap gap-3"><Link to="/portal/requests" className="portal-btn-primary whitespace-nowrap">Review drafts</Link><button className="portal-btn-secondary whitespace-nowrap" onClick={reset}>Upload another file</button></div>
        </section>
      )}

      <section className={`${panelCls} mt-6 p-4 sm:p-6`} aria-labelledby="up-hist">
        <h2 id="up-hist" className="ds-subheading uppercase text-ds-primary">Recent uploads</h2>
        {history.isLoading ? <p role="status" className="ds-support mt-2">Loading…</p> : history.isError ? <p role="alert" className="ds-support mt-2">Upload history is unavailable.</p> : !h?.jobs?.length ? <p className="ds-support mt-2 rounded-ds bg-ds-surface-muted p-3">No uploads yet.</p> : (
          <ul className="mt-3 divide-y divide-ds-border rounded-ds-sm border border-ds-border">{h.jobs.map((j: any) => <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span className="ds-support">{new Date(j.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })} · {String(j.source_type ?? "csv").toUpperCase()} · {j.kind === "delivery" ? "Medical Delivery" : "Passenger"} · {j.submitted_rows} draft{j.submitted_rows === 1 ? "" : "s"} of {j.total_rows}</span>
            {j.originalId ? <button className="ds-support whitespace-nowrap font-semibold text-ds-primary underline" onClick={() => openOriginal(j.originalId)}>Open original</button> : <span className="ds-support text-ds-text-2">Original deleted</span>}
          </li>)}</ul>
        )}
      </section>
      <p className="ds-support mt-4 text-ds-text-2">Rows exported to an error report contain only row numbers and problem descriptions. Results: <button className="underline" onClick={() => download("mfn-upload-columns.csv", (kind === "passenger" ? "" : "") + [csvCell("Use the template columns")].join(","))}>column guide</button></p>
    </>
  );
}
