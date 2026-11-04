import { useState } from "react";
import { Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DsButton } from "@/components/ds/controls";
import { setFleetResourceStatus, listFleetStatusHistory } from "@/lib/provider-ops.functions";
import { usePortalMutation, usePortalQuery } from "./preview-data";

export type FleetFilter = { q: string; status: "active" | "inactive" | "all" };
export function useFleetFilter() { return useState<FleetFilter>({ q: "", status: "active" }); }
export function applyFleetFilter<T extends { status?: string | null }>(rows: T[], f: FleetFilter, text: (r: T) => string) {
  const n = f.q.trim().toLowerCase();
  return rows.filter((r) => (f.status === "all" || (f.status === "inactive" ? r.status === "inactive" : r.status !== "inactive")) && (!n || text(r).toLowerCase().includes(n)));
}

/** One aligned row: search (icon never overlaps text) + status filter. Stacks on phones. */
export function FleetFilterBar({ value, onChange, noun }: { value: FleetFilter; onChange: (f: FleetFilter) => void; noun: string }) {
  return <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
    <label className="relative block"><span className="sr-only">Search {noun}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ds-text-2" aria-hidden />
      <input value={value.q} onChange={(e) => onChange({ ...value, q: e.target.value })} placeholder={`Search ${noun}`} className="portal-control w-full !pl-10" /></label>
    <select aria-label={`Filter ${noun} by status`} value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as FleetFilter["status"] })} className="portal-control w-full">
      <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option>
    </select>
  </div>;
}

/** Deactivate/restore with confirmation + reason; history is append-only on the server. Never deletes. */
export function FleetStatusControl({ kind, id, status, name }: { kind: "driver" | "vehicle"; id: string; status: string | null | undefined; name: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [history, setHistory] = useState(false);
  const qc = useQueryClient();
  const inactive = status === "inactive"; const next = inactive ? "active" : "inactive";
  const m = usePortalMutation({
    mutationFn: () => setFleetResourceStatus({ data: { kind, id, status: next, reason } }),
    onSuccess: () => { toast.success(inactive ? "Restored" : "Deactivated"); setOpen(false); setReason(""); qc.invalidateQueries({ queryKey: [kind === "driver" ? "drivers" : "vehicles"] }); qc.invalidateQueries({ queryKey: ["my-drivers"] }); qc.invalidateQueries({ queryKey: ["fleet-history", id] }); },
    onError: () => toast.error("This action is unavailable."),
  });
  const h = usePortalQuery({ queryKey: ["fleet-history", id], enabled: history, queryFn: () => listFleetStatusHistory({ data: { kind, id } }) });
  return <span className="inline-flex flex-wrap items-center gap-3">
    <button type="button" onClick={() => setOpen(true)} className={inactive ? "font-bold text-ds-primary hover:underline" : "font-bold text-ds-error hover:underline"}>{inactive ? "Restore" : "Deactivate"}</button>
    <button type="button" onClick={() => setHistory((v) => !v)} className="portal-secondary-control font-bold text-ds-primary hover:underline">History</button>
    {open && <div role="dialog" aria-modal="true" aria-label={`${inactive ? "Restore" : "Deactivate"} ${name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-ds-primary/40 p-4">
      <div className="portal-custom-dialog w-full max-w-md space-y-3 rounded-ds border border-ds-sky-border bg-ds-surface p-5 shadow-[var(--ds-shadow)]">
        <h3 className="ds-subheading text-ds-primary">{inactive ? "Restore" : "Deactivate"} {name}?</h3>
        <p className="ds-support">{inactive ? "It can receive new assignments again." : "It stays visible under the Inactive filter and keeps all trip, assignment and earnings history. It cannot receive new assignments."}</p>
        <label className="portal-dialog-section ds-label block">Reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} className="portal-input mt-1" /></label>
        <div className="portal-dialog-actions flex flex-wrap justify-end gap-2"><DsButton variant="ghost" onClick={() => setOpen(false)}>Cancel</DsButton>
          <DsButton disabled={reason.trim().length < 3 || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Saving…" : "Confirm"}</DsButton></div>
      </div></div>}
    {history && <span className="portal-dialog-rows block w-full basis-full rounded-ds border border-ds-sky-border bg-ds-sky p-2">
      {h.isLoading ? "Loading…" : (h.data ?? []).length === 0 ? "No status changes recorded." : (h.data ?? []).map((e) => <span key={e.id} className="ds-caption block">{new Date(e.created_at).toLocaleString()} · {e.previous_status ?? "Not set"} → {e.new_status} · {e.actor_mfn_id ?? "Not available"} · {e.reason}</span>)}
    </span>}
  </span>;
}
