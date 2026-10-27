import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { CSV_MAX_BYTES, CSV_MAX_ROWS, errorReport, fileKey, parseCsv, templateCsv, validateRows, csvCell, type ImportKind, type ValidatedRow } from "@/lib/csv-import";
import { importCsvRequests } from "@/lib/csv-import.functions";

export const Route = createFileRoute("/_authenticated/portal/upload-csv")({
  head: () => ({ meta: [{ title: "Upload CSV — MY FLORIDA NEMT" }, { name: "description", content: "Review and upload authorized transportation or medical delivery requests for your MY FLORIDA NEMT account." }, { property: "og:title", content: "Upload CSV — MY FLORIDA NEMT" }, { property: "og:description", content: "Review transportation and medical delivery requests before submitting your CSV." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalUploadCsv,
});

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Summary = Awaited<ReturnType<typeof importCsvRequests>>;

function PortalUploadCsv() {
  const run = useServerFn(importCsvRequests);
  const [kind, setKind] = useState<ImportKind>("passenger");
  const [rows, setRows] = useState<(ValidatedRow & { dup?: number })[] | null>(null);
  const [key, setKey] = useState("");
  const [fileError, setFileError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  function reset() { setRows(null); setSummary(null); setConfirm(false); setFileError(""); }

  async function onFile(f: File | undefined) {
    reset();
    if (!f) return;
    const isCsvName = /\.csv$/i.test(f.name);
    if (!isCsvName || (f.type && !/csv|plain|excel/i.test(f.type))) return setFileError("Choose a .csv file.");
    if (f.size > CSV_MAX_BYTES) return setFileError("That file is too large (limit 512 KB).");
    const text = await f.text();
    if (/[\u0000-\u0008]/.test(text.slice(0, 2000))) return setFileError("That file isn't a plain-text CSV.");
    const all = parseCsv(text);
    if (all.length < 2) return setFileError("The file has no data rows.");
    if (all.length - 1 > CSV_MAX_ROWS) return setFileError(`Up to ${CSV_MAX_ROWS} rows per file.`);
    setKey(await fileKey(text, kind));
    setRows(validateRows(kind, all[0], all.slice(1)) as any);
  }

  async function onSubmit() {
    if (!rows) return;
    setBusy(true);
    try {
      const valid = rows.filter((r) => r.ok && r.dup === undefined);
      const res = await run({ data: { kind, idempotencyKey: key, rows: valid.map((r) => ({ row: r.row, data: r.data })) } });
      setSummary(res);
      if (res.duplicateFile) toast.message("This file was already imported, so nothing new was submitted.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const valid = rows?.filter((r) => r.ok && r.dup === undefined) ?? [];
  const invalid = rows?.filter((r) => !r.ok) ?? [];
  const dups = rows?.filter((r) => r.dup !== undefined) ?? [];
  const dates = [...new Set(valid.map((r) => r.date))].sort();

  return (
    <>
      <PageHead title="Upload CSV">Import up to {CSV_MAX_ROWS} requests at once. Every row is checked the same way as a single request, and nothing is submitted until you confirm.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <fieldset>
          <legend className="portal-label">1. Request type</legend>
          <div className="flex flex-wrap gap-4">
            {(["passenger", "delivery"] as const).map((k) => (
              <label key={k} className="ds-body flex items-center gap-2"><input type="radio" name="kind" checked={kind === k} onChange={() => { setKind(k); reset(); }} />{k === "passenger" ? "Passenger transportation" : "Medical Delivery"}</label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4"><button onClick={() => download(`mfn-${kind}-template.csv`, templateCsv(kind))} className="portal-btn-secondary">Download template</button></div>
        <div className="mt-4">
          <label htmlFor="csv-file" className="portal-label">2. Upload CSV</label>
          <input id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="ds-body block max-w-full" aria-describedby={fileError ? "csv-err" : undefined} />
          {fileError && <p id="csv-err" role="alert" className="ds-support mt-2 font-semibold text-ds-error">{fileError}</p>}
        </div>
      </section>

      {rows && !summary && (
        <section className={`${panelCls} mt-6 p-4 sm:p-6`} aria-labelledby="csv-prev">
          <h2 id="csv-prev" className="ds-subheading uppercase text-ds-primary">3. Preview</h2>
          <ul className="ds-body mt-2 grid gap-1 sm:grid-cols-2">
            <li>Total rows: <strong>{rows.length}</strong></li>
            <li>Valid rows: <strong>{valid.length}</strong></li>
            <li>Rows with problems: <strong>{invalid.length}</strong></li>
            <li>Possible duplicates (skipped): <strong>{dups.length}</strong></li>
            <li>Type: <strong>{kind === "passenger" ? "Passenger transportation" : "Medical Delivery"}</strong></li>
            <li>Requested dates: <strong>{dates.length ? `${dates[0]}${dates.length > 1 ? ` – ${dates[dates.length - 1]}` : ""}` : "—"}</strong></li>
          </ul>
          {(invalid.length > 0 || dups.length > 0) && (
            <div className="mt-4">
              <ul className="ds-support max-h-64 space-y-1 overflow-y-auto" aria-label="Row problems">
                {invalid.map((r) => <li key={r.row}><strong>Row {r.row}:</strong> {r.errors.join("; ")}</li>)}
                {dups.map((r) => <li key={`d${r.row}`}><strong>Row {r.row}:</strong> looks like a duplicate of row {r.dup}</li>)}
              </ul>
              <button className="portal-btn-secondary mt-3" onClick={() => download("mfn-import-errors.csv", errorReport([...invalid, ...dups.map((r) => ({ row: r.row, errors: [`Possible duplicate of row ${r.dup}`] }))]))}>Download error report</button>
            </div>
          )}
          <label className="ds-body mt-4 flex items-start gap-2">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
            I understand submitting these requests does not guarantee a provider will be available or accept them.
          </label>
          <button disabled={!confirm || valid.length === 0 || busy} onClick={onSubmit} className="portal-btn-primary mt-4">{busy ? "Submitting…" : `Submit ${valid.length} request${valid.length === 1 ? "" : "s"}`}</button>
        </section>
      )}

      {summary && (
        <section className={`${panelCls} mt-6 p-4 sm:p-6`} aria-live="polite">
          <h2 className="ds-subheading uppercase text-ds-primary">Import summary</h2>
          <p className="ds-body mt-2">{summary.duplicateFile ? "This exact file was already imported earlier — nothing new was submitted." : `${summary.submitted} submitted, ${summary.failed} not saved, ${invalid.length + dups.length} skipped before submission.`}</p>
          {summary.results.length > 0 && <button className="portal-btn-secondary mt-3" onClick={() => download("mfn-import-results.csv", "row,result,request\n" + summary.results.map((r) => [r.row, r.ok ? "submitted" : r.reason, r.mfnId ?? ""].map(csvCell).join(",")).join("\n"))}>Download results</button>}
          <button className="portal-btn-secondary ml-3 mt-3" onClick={reset}>Import another file</button>
        </section>
      )}
    </>
  );
}
