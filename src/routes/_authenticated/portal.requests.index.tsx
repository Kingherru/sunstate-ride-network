import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Copy, Trash2, FilePenLine } from "lucide-react";
import { copyRequestToDraft, listPortalRequests, type RequestListRow } from "@/lib/portal-requests.functions";
import { deleteTripDraft, listTripDrafts, saveTripDraft } from "@/lib/trip-drafts.functions";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { SegTabs } from "@/components/portal/SegTabs";
import { StatusBadge, categoryLabel, fmtDateTime, isDelivery, serviceLabel, shortId, sourceLabel } from "@/components/portal/request-display";
import { useRequestDetails } from "@/components/portal/request-detail-context";
import { usePortalMutation, usePortalQuery, previewBlocked, usePortalPreview } from "@/components/portal/preview-data";
import { DsButton } from "@/components/ds/controls";
import { DsEmpty } from "@/components/ds/feedback";

export const Route = createFileRoute("/_authenticated/portal/requests/")({
  head: () => ({ meta: [{ title: "Trip History — MY FLORIDA NEMT Portal" }, { name: "robots", content: "noindex, nofollow" }] }),
  loader: () => listPortalRequests(),
  component: Requests,
});

const PAGE = 20;
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

function Requests() {
  const rows = Route.useLoaderData();
  const [tab, setTab] = useState<"history" | "drafts">("history");
  return (
    <>
      <PageHead title="Trip history" action={<Link to="/portal/requests/new" className={actionCls}>New trip</Link>}>
        Only requests you're authorized to view are shown.
      </PageHead>
      <SegTabs label="Trip history sections" value={tab} onChange={setTab} options={[{ value: "history", label: "History" }, { value: "drafts", label: "Drafts" }]} />
      <div className="mt-4">{tab === "history" ? <History rows={rows} /> : <Drafts />}</div>
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
      </div>

      {visible.length === 0 ? (
        <DsEmpty title={rows.length === 0 ? "No requests yet" : "Nothing matches"} action={rows.length === 0 ? <Link to="/portal/requests/new" className={actionCls}>New trip</Link> : undefined}>
          {rows.length === 0
            ? "Submit a passenger transportation or medical delivery request to get started."
            : includeOlder ? "Try a different search." : "Nothing from the last 60 days matches. Include older history or change the search."}
        </DsEmpty>
      ) : (
        <>
          {/* Phone: stacked cards */}
          <ul className="divide-y divide-ds-border md:hidden">
            {visible.map((r) => (
              <li key={r.id} className="px-4 py-4">
                <button type="button" onClick={() => open({ kind: "request", id: r.id })} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <span className="ds-label text-ds-primary">{r.mfn_id ?? `#${shortId(r.id)}`}</span>
                    <StatusBadge status={r.network_status || r.status} />
                  </div>
                  <p className="ds-body mt-1">{[r.patient_first_name, r.patient_last_name].filter(Boolean).join(" ") || categoryLabel(r)}</p>
                  <p className="ds-support mt-0.5">{[r.pickup_city, r.dropoff_city].filter(Boolean).join(" → ") || "Route not provided"}</p>
                  <p className="ds-support mt-0.5">{fmtDateTime(r.created_at)} · {sourceLabel(r.submitted_via)}</p>
                </button>
                <div className="mt-2 flex justify-end">
                  <CopyButton busy={copying === r.id} onClick={() => copyToNewTrip(r)} />
                </div>
              </li>
            ))}
          </ul>
          {/* Desktop: table */}
          <table className="hidden w-full text-left md:table">
            <thead className="ds-support uppercase tracking-[0.06em]">
              <tr className="border-b border-ds-border">
                <th scope="col" className="px-4 py-3 font-semibold">Request</th>
                <th scope="col" className="px-4 py-3 font-semibold">Rider</th>
                <th scope="col" className="px-4 py-3 font-semibold">Route</th>
                <th scope="col" className="px-4 py-3 font-semibold">Requested</th>
                <th scope="col" className="px-4 py-3 font-semibold">Service</th>
                <th scope="col" className="px-4 py-3 font-semibold">Provider</th>
                <th scope="col" className="px-4 py-3 font-semibold">Source</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="ds-body">
              {visible.map((r) => (
                <tr key={r.id} tabIndex={0} role="button" aria-label={`Open request ${r.mfn_id || shortId(r.id)}`}
                  onClick={() => open({ kind: "request", id: r.id })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open({ kind: "request", id: r.id }); } }}
                  className="cursor-pointer border-b border-ds-border last:border-0 hover:bg-ds-surface-muted focus-visible:outline-2 focus-visible:outline-ds-focus">
                  <td className="px-4 py-3"><span className="font-semibold text-ds-link">{r.mfn_id ?? `#${shortId(r.id)}`}</span></td>
                  <td className="px-4 py-3">{[r.patient_first_name, r.patient_last_name].filter(Boolean).join(" ") || "Not provided"}</td>
                  <td className="px-4 py-3">{[r.pickup_city, r.dropoff_city].filter(Boolean).join(" → ") || "Not provided"}</td>
                  <td className="px-4 py-3">{r.pickup_date ? `${fmtDate(r.pickup_date)}${r.pickup_time ? ` · ${fmtTime(r.pickup_time)}` : ""}` : fmtDateTime(r.created_at)}</td>
                  <td className="px-4 py-3">{categoryLabel(r)}{!isDelivery(r) && ` · ${serviceLabel(r)}`}</td>
                  <td className="px-4 py-3">{r.selected_provider_mfn_id ?? "Not assigned"}</td>
                  <td className="px-4 py-3">{sourceLabel(r.submitted_via)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.network_status || r.status} /></td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <CopyButton busy={copying === r.id} onClick={() => copyToNewTrip(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
