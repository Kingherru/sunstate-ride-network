import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Copy, Trash2, FilePenLine } from "lucide-react";
import { copyRequestToDraft, listPortalRequests, type RequestListRow } from "@/lib/portal-requests.functions";
import { deleteTripDraft, listTripDrafts, saveTripDraft } from "@/lib/trip-drafts.functions";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { PortalTabbedLayout } from "@/components/portal/PortalTabbedLayout";
import { StatusBadge, categoryLabel, fmtDateTime, isDelivery, serviceLabel, shortId, sourceLabel } from "@/components/portal/request-display";
import { useRequestDetails } from "@/components/portal/request-detail-context";
import { usePortalMutation, usePortalQuery, previewBlocked, usePortalPreview } from "@/components/portal/preview-data";
import { DsButton } from "@/components/ds/controls";
import { exportTable, readableDate, type ExportFormat } from "@/lib/table-export";
import { DsEmpty } from "@/components/ds/feedback";
import {PatientTrips} from '@/components/portal/PatientTrips';
import {RecordTable} from '@/components/portal/RecordTable';
import {CustomerSelectedExport} from '@/components/portal/CustomerSelectedExport';

export const Route = createFileRoute("/_authenticated/portal/requests/")({
  head: () => ({ meta: [{ title: "Trip History — MY FLORIDA NEMT Portal" },{name:'description',content:'Authorized upcoming trips, patient timeline, history and existing payment records.'},{property:'og:title',content:'Trip History — MY FLORIDA NEMT Portal'},{property:'og:description',content:'Your authorized trip timeline and history.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => listPortalRequests(),
  component: Requests,
});

const PAGE = 20;
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

function Requests() {
  const rows = Route.useLoaderData();
  const {access}=Route.useRouteContext();
  const [tab, setTab] = useState<"history" | "drafts">("history");
  return (
    <>
      <PageHead title="Trip history" action={<div className="flex flex-wrap gap-2">{access.canUploadCsvRequests && <Link to="/portal/upload-csv" className="portal-btn-secondary">Import trips</Link>}<Link to="/portal/requests/new" className={actionCls}>New trip</Link></div>}>
        Only requests you're authorized to view are shown.
      </PageHead>
      <PortalTabbedLayout label="Trip history sections" queryKey="view" value={tab} onChange={setTab} options={[{ value: "history", label: "History" }, { value: "drafts", label: "Drafts" }]} >
      <div className="mt-4">{tab === "history" ? access.primary?.type==='private_pay'?<PatientTrips/>:<History rows={rows} /> : <Drafts />}</div>
    </PortalTabbedLayout>
    </>
  );
}

function History({ rows }: { rows: RequestListRow[] }) {
  const open = useRequestDetails();
  const navigate = useNavigate();
  const copyFn = useServerFn(copyRequestToDraft);
  const preview = usePortalPreview();
  const [search, setSearch] = useState("");
  const [includeOlder, setIncludeOlder] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [copying, setCopying] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - SIXTY_DAYS_MS;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!includeOlder && new Date(r.created_at).getTime() < cutoff) return false;
      if (!q) return true;
      const hay = [
        r.mfn_id, r.patient_first_name, r.patient_last_name, r.pickup_city, r.dropoff_city,
        categoryLabel(r), serviceLabel(r), r.status, r.network_status, r.trip_type,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, includeOlder]);

  const visible = filtered.slice(0, shown);
  const [format, setFormat] = useState<ExportFormat>("csv");
  async function onExport() {
    if (preview.active) { previewBlocked(); return; }
    if (!filtered.length) { toast("Nothing to export with the current filters."); return; }
    try {
      await exportTable(filtered, [
        { label: "Request ID", value: (r) => r.mfn_id ?? shortId(r.id) },
        { label: "Submitted", value: (r) => readableDate(r.created_at) },
        { label: "Rider", value: (r) => [r.patient_first_name, r.patient_last_name].filter(Boolean).join(" ") },
        { label: "Category", value: (r) => categoryLabel(r) },
        { label: "Service", value: (r) => serviceLabel(r) },
        { label: "Pickup date", value: (r) => readableDate(r.pickup_date) },
        { label: "Pickup time", value: (r) => r.pickup_time ?? "" },
        { label: "From", value: (r) => r.pickup_city ?? "" },
        { label: "To", value: (r) => r.dropoff_city ?? "" },
        { label: "Status", value: (r) => r.status ?? "" },
      ], "Trip history", format, `trip-history-${new Date().toISOString().slice(0, 10)}`);
    } catch { toast.error("Could not export trip history."); }
  }

  async function copyToNewTrip(r: RequestListRow) {
    if (preview.active) { previewBlocked(); return; }
    setCopying(r.id);
    try {
      const res = await copyFn({ data: { id: r.id } });
      if (!res.ok) { toast.error("This request could not be copied."); return; }
      toast.success("Copied to a new draft. Review it before submitting.");
      navigate({ to: "/portal/requests/new", search: { draft: res.draftId } });
    } catch {
      toast.error("This request could not be copied.");
    } finally {
      setCopying(null);
    }
  }

  return (
    <section className={panelCls}>
      <div className="px-4 sm:px-5"><CustomerSelectedExport records={filtered.map(r=>({id:r.id,label:`${r.mfn_id??'Request'} · ${r.pickup_date??''} · ${r.pickup_city??''} → ${r.dropoff_city??''}`}))}/></div>
      <div className="flex flex-wrap items-center gap-3 border-b border-ds-border px-4 py-3 sm:px-5">
        <div className="portal-search min-w-0 flex-1">
          <Search className="size-4" aria-hidden />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }}
            placeholder="Search rider, request ID, city, service or status"
            aria-label="Search trip history"
            className="w-full rounded-sm border border-ds-border py-2 pr-3 text-sm"
          />
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={includeOlder} onChange={(e) => { setIncludeOlder(e.target.checked); setShown(PAGE); }} />
          Include history older than 60 days
        </label>
        <div className="flex shrink-0 items-center gap-2">
          <label htmlFor="th-format" className="sr-only">Export format</label>
          <select id="th-format" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} className="h-9 rounded-sm border border-ds-border bg-ds-surface px-2 text-sm">
            <option value="csv">CSV</option><option value="xlsx">Excel</option><option value="pdf">PDF</option>
          </select>
          <DsButton size="sm" variant="secondary" className="h-9 whitespace-nowrap" onClick={onExport}>Export</DsButton>
        </div>
      </div>

      {visible.length === 0 ? (
        <DsEmpty title={rows.length === 0 ? "No requests yet" : "Nothing matches"} action={rows.length === 0 ? <Link to="/portal/requests/new" className={actionCls}>New trip</Link> : undefined}>
          {rows.length === 0
            ? "Submit a passenger transportation or medical delivery request to get started."
            : includeOlder ? "Try a different search." : "Nothing from the last 60 days matches. Include older history or change the search."}
        </DsEmpty>
      ) : (
        <>
          <RecordTable<RequestListRow> tableId="portal-request-history" rows={visible} rowKey={r=>r.id}
            onRowClick={r=>open({kind:'request',id:r.id})} rowLabel={r=>`Open request ${r.mfn_id || shortId(r.id)}`} columns={[
              {id:'request',label:'Request',width:210,minWidth:180,render:r=>r.mfn_id ?? `#${shortId(r.id)}`},
              {id:'rider',label:'Rider',width:240,render:r=>[r.patient_first_name,r.patient_last_name].filter(Boolean).join(' ') || 'Not provided'},
              {id:'route',label:'Route',width:250,render:r=>[r.pickup_city,r.dropoff_city].filter(Boolean).join(' → ') || 'Not provided'},
              {id:'requested',label:'Requested',width:250,render:r=>r.pickup_date?`${fmtDate(r.pickup_date)}${r.pickup_time?` · ${fmtTime(r.pickup_time)}`:''}`:fmtDateTime(r.created_at)},
              {id:'service',label:'Service',width:290,render:r=>`${categoryLabel(r)}${!isDelivery(r)?` · ${serviceLabel(r)}`:''}`},
              {id:'provider',label:'Provider',width:220,hideable:true,render:r=>r.selected_provider_mfn_id ?? 'Not assigned'},
              {id:'source',label:'Source',hideable:true,render:r=>sourceLabel(r.submitted_via)},
              {id:'status',label:'Status',width:290,minWidth:280,wrap:true,render:r=><StatusBadge status={r.network_status || r.status}/>},
              {id:'actions',label:'Actions',width:240,minWidth:230,wrap:true,render:r=><CopyButton busy={copying===r.id} onClick={()=>copyToNewTrip(r)}/>},
            ]}/>
          {filtered.length > shown && (
            <div className="border-t border-ds-border px-4 py-3 text-center sm:px-5">
              <DsButton variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({filtered.length - shown} remaining)
              </DsButton>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CopyButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <DsButton variant="ghost" size="sm" disabled={busy} onClick={onClick} className="whitespace-nowrap">
      <Copy className="size-4" aria-hidden /> {busy ? "Copying…" : "Copy to new trip"}
    </DsButton>
  );
}

function fmtDate(d: string) {
  return new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(t: string) {
  return new Date(`2000-01-01T${t}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Drafts() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = usePortalQuery({ queryKey: ["trip-drafts"], queryFn: () => listTripDrafts() });
  const saveFn = useServerFn(saveTripDraft);

  const del = usePortalMutation({
    mutationFn: (id: string) => deleteTripDraft({ data: { draft_id: id } }),
    onSuccess: () => { toast.success("Draft removed"); qc.invalidateQueries({ queryKey: ["trip-drafts"] }); },
    onError: () => toast.error("Could not remove the draft."),
  });

  const copy = usePortalMutation({
    mutationFn: (payload: Record<string, unknown>) => saveFn({ data: { payload, autosaved: false } }),
    onSuccess: () => { toast.success("Draft copied"); qc.invalidateQueries({ queryKey: ["trip-drafts"] }); },
    onError: () => toast.error("Could not copy the draft."),
  });

  const drafts = q.data ?? [];
  return (
    <section className={panelCls}>
      {q.isLoading ? (
        <p className="ds-body px-4 py-5 text-ds-text-2 sm:px-5">Loading drafts…</p>
      ) : drafts.length === 0 ? (
        <DsEmpty title="No drafts" action={<Link to="/portal/requests/new" className={actionCls}>New trip</Link>}>
          Save a draft from the New trip form and it will appear here for review.
        </DsEmpty>
      ) : (
        <ul className="divide-y divide-ds-border">
          {drafts.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="ds-body font-semibold">{d.summary || "Untitled draft"}</p>
                <p className="ds-support mt-0.5">Last saved {fmtDateTime(d.updated_at)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <DsButton variant="secondary" size="sm" className="whitespace-nowrap"
                  onClick={() => navigate({ to: "/portal/requests/new", search: { draft: d.id } })}>
                  <FilePenLine className="size-4" aria-hidden /> Open & edit
                </DsButton>
                <DsButton variant="ghost" size="sm" className="whitespace-nowrap" disabled={copy.isPending}
                  onClick={() => copy.mutate(d.payload)}>
                  <Copy className="size-4" aria-hidden /> Copy
                </DsButton>
                <DsButton variant="ghost" size="sm" className="whitespace-nowrap text-ds-error" disabled={del.isPending}
                  onClick={() => { if (window.confirm("Remove this draft? This cannot be undone.")) del.mutate(d.id); }}>
                  <Trash2 className="size-4" aria-hidden /> Remove
                </DsButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
