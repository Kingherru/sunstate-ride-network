import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { usePortalMutation, usePortalQuery } from "@/components/portal/preview-data";
import {
  PLATFORM_REQUEST_CATEGORIES, PLATFORM_REQUEST_STATUSES,
  submitPlatformRequest, listMyPlatformRequests, getPlatformRequestEvents, replyPlatformRequest,
  listPlatformRequestsAdmin, getPlatformRequestEventsAdmin, replyPlatformRequestAdmin, setPlatformRequestStatus,
  type PlatformRequestRow, type PlatformRequestEvent,
} from "@/lib/platform-requests.functions";
import { cn } from "@/lib/utils";

const catLabel = (v: string) => PLATFORM_REQUEST_CATEGORIES.find((c) => c.value === v)?.label ?? v;
const statusLabel = (v: string) => PLATFORM_REQUEST_STATUSES.find((s) => s.value === v)?.label ?? v;

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
      status === "resolved" ? "bg-ds-success-soft text-ds-success"
      : status === "waiting_for_provider" ? "bg-ds-warning-soft text-ds-warning"
      : status === "in_progress" ? "bg-ds-info-soft text-ds-info"
      : "bg-ds-subtle text-ds-text-2")}>
      {statusLabel(status)}
    </span>
  );
}

function EventHistory({ events }: { events: PlatformRequestEvent[] }) {
  if (events.length === 0) return <p className="ds-support">No history yet.</p>;
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="rounded-ds-sm bg-ds-bg px-3 py-2">
          <p className="ds-support font-semibold">
            {e.event_type === "created" ? "Submitted" : e.event_type === "reply_provider" ? "Provider reply" : e.event_type === "reply_admin" ? "Support reply" : `Status: ${statusLabel(e.from_status ?? "")} → ${statusLabel(e.to_status ?? "")}`}
            {e.actor_name ? ` · ${e.actor_name}` : ""}
          </p>
          {e.body && <p className="ds-body whitespace-pre-wrap break-words">{e.body}</p>}
          <p className="ds-caption mt-0.5">{new Date(e.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}

function RequestDetail({ req, admin, canManage, onBack }: { req: PlatformRequestRow; admin: boolean; canManage: boolean; onBack: () => void }) {
  const qc = useQueryClient();
  const eventsFn = useServerFn(admin ? getPlatformRequestEventsAdmin : getPlatformRequestEvents);
  const replyFn = useServerFn(admin ? replyPlatformRequestAdmin : replyPlatformRequest);
  const statusFn = useServerFn(setPlatformRequestStatus);
  const [reply, setReply] = useState("");

  const events = usePortalQuery<PlatformRequestEvent[]>({
    queryKey: ["platform-request-events", req.id],
    queryFn: () => eventsFn({ data: { requestId: req.id } }),
  });

  const replyM = usePortalMutation({
    mutationFn: () => replyFn({ data: { requestId: req.id, body: reply } }),
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["platform-request-events", req.id] }); qc.invalidateQueries({ queryKey: ["platform-requests"] }); toast.success("Reply sent."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const statusM = usePortalMutation({
    mutationFn: (status: string) => statusFn({ data: { requestId: req.id, status: status as any } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-requests"] }); qc.invalidateQueries({ queryKey: ["platform-request-events", req.id] }); toast.success("Status updated."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canReply = admin ? canManage : req.status !== "resolved";
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="ds-support inline-flex items-center gap-1.5 font-semibold uppercase text-ds-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to requests
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="ds-subheading text-ds-primary">{req.subject}</h3>
          <p className="ds-support mt-0.5 font-mono">{req.mfn_id ?? "—"}</p>
          <p className="ds-support">{catLabel(req.category)}{req.workspace_name ? ` · ${req.workspace_name}` : ""}{req.submitter_name ? ` · ${req.submitter_name}` : ""}</p>
          <p className="ds-caption mt-0.5">Created {new Date(req.created_at).toLocaleString()} · Updated {new Date(req.updated_at).toLocaleString()}</p>
        </div>
        <StatusPill status={req.status} />
      </div>
      {admin && canManage && (
        <label className="ds-support flex max-w-xs flex-col gap-1">
          <span className="font-semibold uppercase tracking-[0.06em]">Status</span>
          <select className="portal-input" value={req.status} disabled={statusM.isPending}
            onChange={(e) => statusM.mutate(e.target.value)}>
            {PLATFORM_REQUEST_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
      )}
      <div>
        <h4 className="ds-label mb-2 uppercase text-ds-primary">History</h4>
        {events.isLoading ? <p className="ds-support">Loading…</p> : <EventHistory events={events.data ?? []} />}
      </div>
      {canReply && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) replyM.mutate(); }}>
          <label htmlFor={`reply-${req.id}`} className="portal-label">Reply</label>
          <textarea id={`reply-${req.id}`} className="portal-input min-h-24" maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} />
          <button type="submit" disabled={replyM.isPending || !reply.trim()} className="portal-btn-primary inline-flex items-center gap-1.5">
            <Send className="size-4" aria-hidden /> Send reply
          </button>
        </form>
      )}
    </div>
  );
}

/** Provider Settings → Platform requests: submit and follow own requests. */
export function ProviderPlatformRequests({ workspaceId }: { workspaceId: string }) {
  const submitFn = useServerFn(submitPlatformRequest);
  const listFn = useServerFn(listMyPlatformRequests);
  const [selected, setSelected] = useState<PlatformRequestRow | null>(null);
  const [composing, setComposing] = useState(false);
  const [category, setCategory] = useState<string>("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const q = usePortalQuery<PlatformRequestRow[]>({
    queryKey: ["platform-requests", workspaceId],
    queryFn: () => listFn({ data: { workspaceId } }),
  });

  const submit = usePortalMutation({
    mutationFn: () => submitFn({ data: { workspaceId, category: category as any, subject, message } }),
    onSuccess: (r) => { toast.success(`Request ${r.mfnId ?? ""} submitted.`); setComposing(false); setSubject(""); setMessage(""); setCategory("question"); q.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (selected) return <RequestDetail req={selected} admin={false} canManage={false} onBack={() => { setSelected(null); q.refetch(); }} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="ds-support max-w-2xl">Ask the MY FLORIDA NEMT team for help with your account, trips, payments, verification or the platform itself. Replies appear here — no email is sent.</p>
        {!composing && <button type="button" className="portal-btn-primary" onClick={() => setComposing(true)}>New request</button>}
      </div>
      {composing && (
        <form className="max-w-xl space-y-3 rounded-ds-sm border border-ds-border p-4" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
          <label className="block"><span className="portal-label">Category</span>
            <select className="portal-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {PLATFORM_REQUEST_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="block"><span className="portal-label">Subject</span>
            <input className="portal-input" required minLength={3} maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block"><span className="portal-label">Message</span>
            <textarea className="portal-input min-h-28" required maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="portal-btn-primary" disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit request"}</button>
            <button type="button" className="portal-btn-secondary" onClick={() => setComposing(false)}>Cancel</button>
          </div>
        </form>
      )}
      {q.isLoading && <p className="ds-support">Loading…</p>}
      {!q.isLoading && (q.data ?? []).length === 0 && <p className="ds-support text-ds-text-2">No platform requests yet.</p>}
      <ul className="divide-y divide-ds-border rounded-ds-sm border border-ds-border">
        {(q.data ?? []).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setSelected(r)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-ds-bg">
              <span className="min-w-0">
                <span className="ds-body block truncate font-semibold">{r.subject}</span>
                <span className="ds-support font-mono">{r.mfn_id ?? "—"}</span>
                <span className="ds-support"> · {catLabel(r.category)} · {new Date(r.created_at).toLocaleDateString()}</span>
              </span>
              <StatusPill status={r.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Admin Messaging → Requests tab. */
export function AdminPlatformRequests({ canManage }: { canManage: boolean }) {
  const listFn = useServerFn(listPlatformRequestsAdmin);
  const [selected, setSelected] = useState<PlatformRequestRow | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const q = usePortalQuery<PlatformRequestRow[]>({
    queryKey: ["platform-requests", "admin"],
    queryFn: () => listFn(),
  });

  if (selected) return <RequestDetail req={selected} admin canManage={canManage} onBack={() => { setSelected(null); q.refetch(); }} />;

  const rows = (q.data ?? []).filter((r) => statusFilter === "all" || r.status === statusFilter);
  return (
    <div className="space-y-4">
      <div className="portal-toolbar">
        <select className="portal-control" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {PLATFORM_REQUEST_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {q.isLoading && <p className="ds-support">Loading…</p>}
      {!q.isLoading && rows.length === 0 && <p className="ds-support text-ds-text-2">No platform requests.</p>}
      <ul className="divide-y divide-ds-border rounded-ds-sm border border-ds-border">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setSelected(r)} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-ds-bg">
              <span className="min-w-0">
                <span className="ds-body block truncate font-semibold">{r.subject}</span>
                <span className="ds-support font-mono">{r.mfn_id ?? "—"}</span>
                <span className="ds-support"> · {r.workspace_name ?? "Workspace"} · {r.submitter_name ?? "Member"} · {catLabel(r.category)} · {new Date(r.created_at).toLocaleDateString()}</span>
              </span>
              <StatusPill status={r.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
