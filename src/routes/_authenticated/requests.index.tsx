import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listMyRequests, cancelMyRequest } from "@/lib/requests.functions";

export const Route = createFileRoute("/_authenticated/requests/")({
  head: () => ({
    meta: [
      { title: "My Ride Requests — FloridaNEMT" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

type Row = {
  id: string;
  status: string;
  created_at: string;
  canceled_at: string | null;
  cancel_reason: string | null;
  pickup_address: string;
  pickup_city: string;
  pickup_date: string;
  pickup_time: string;
  dropoff_address: string;
  dropoff_city: string;
  transport_type: string;
  round_trip: boolean;
  recurrence_rule: string | null;
  patient_first_name: string;
  patient_last_name: string;
  patient_phone: string;
  mobility_notes: string | null;
  special_instructions: string | null;
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-900 border-amber-300",
    new: "bg-amber-100 text-amber-900 border-amber-300",
    assigned: "bg-blue-100 text-blue-900 border-blue-300",
    in_progress: "bg-blue-100 text-blue-900 border-blue-300",
    completed: "bg-green-100 text-green-900 border-green-300",
    canceled: "bg-zinc-100 text-zinc-700 border-zinc-300",
    cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300",
  };
  return map[status?.toLowerCase()] ?? "bg-zinc-100 text-zinc-700 border-zinc-300";
}

function RequestsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMyRequests);
  const cancel = useServerFn(cancelMyRequest);
  const [filter, setFilter] = useState<"upcoming" | "recurring" | "past" | "all">("upcoming");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["my-ride-requests"],
    queryFn: async () => {
      const r = await list();
      if (!r.ok) throw new Error(r.error);
      return r.rows as Row[];
    },
  });

  const cancelM = useMutation({
    mutationFn: async (vars: { id: string; reason: string }) => {
      const r = await cancel({ data: vars });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Ride request canceled.");
      setConfirmId(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["my-ride-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "recurring") return !!r.recurrence_rule;
    const isPast = r.pickup_date < today || ["completed", "canceled", "cancelled"].includes(r.status?.toLowerCase());
    return filter === "past" ? isPast : !isPast;
  });

  const canCancel = (r: Row) =>
    !["completed", "canceled", "cancelled"].includes(r.status?.toLowerCase());

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[var(--brand-navy,#0b1d3a)]">My Ride Requests</h1>
          <p className="text-sm text-zinc-600 mt-1">
            View and cancel ride requests you've submitted. Need a new ride?{" "}
            <Link to="/request-a-ride" className="text-[var(--brand-orange,#f47b20)] underline">
              Request a ride
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <Link
            to="/request-a-ride"
            className="inline-flex items-center rounded-md bg-[var(--brand-orange,#f47b20)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + New request
          </Link>
        </div>

      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["upcoming", "recurring", "past", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm border transition ${
              filter === f
                ? "bg-[var(--brand-navy,#0b1d3a)] text-white border-transparent"
                : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-zinc-600">Loading your requests…</p>}
      {q.isError && <p className="text-red-700">Could not load your requests.</p>}
      {!q.isLoading && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-600">
          No {filter === "all" ? "" : filter} ride requests yet.
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((r) => (
          <li key={r.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge(r.status)}`}>
                    {r.status}
                  </span>
                  {r.recurrence_rule && (
                    <span className="inline-block rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-900">
                      Recurring
                    </span>
                  )}
                  {r.round_trip && (
                    <span className="inline-block rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">
                      Round trip
                    </span>
                  )}
                  <span className="text-xs text-zinc-500 capitalize">{r.transport_type}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-zinc-900">
                  {r.pickup_date} at {r.pickup_time}
                </p>
                <p className="text-sm text-zinc-700">
                  <span className="font-medium">From:</span> {r.pickup_address}, {r.pickup_city}
                </p>
                <p className="text-sm text-zinc-700">
                  <span className="font-medium">To:</span> {r.dropoff_address}, {r.dropoff_city}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Patient: {r.patient_first_name} {r.patient_last_name} · {r.patient_phone}
                </p>
                {r.recurrence_rule && (
                  <p className="mt-1 text-xs text-purple-800">Recurrence: {r.recurrence_rule}</p>
                )}
                {r.canceled_at && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Canceled {new Date(r.canceled_at).toLocaleString()}
                    {r.cancel_reason ? ` — ${r.cancel_reason}` : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Link
                  to="/requests/$id"
                  params={{ id: r.id }}
                  className="rounded-md bg-[var(--brand-navy,#0b1d3a)] px-3 py-1.5 text-center text-sm font-medium text-white hover:opacity-90"
                >
                  View details
                </Link>
                {canCancel(r) && (
                  <button
                    onClick={() => {
                      setConfirmId(r.id);
                      setReason("");
                    }}
                    className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    {r.recurrence_rule ? "Cancel series" : "Cancel"}
                  </button>
                )}
              </div>

            </div>
          </li>
        ))}
      </ul>

      {confirmId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmId(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-zinc-900">Cancel this ride request?</h2>
            <p className="mt-1 text-sm text-zinc-600">
              The provider will be notified. You can submit a new request anytime.
            </p>
            <label className="mt-4 block text-sm font-medium text-zinc-800">
              Reason (optional)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Plans changed, scheduled with another provider, etc."
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Keep request
              </button>
              <button
                disabled={cancelM.isPending}
                onClick={() => cancelM.mutate({ id: confirmId, reason })}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {cancelM.isPending ? "Canceling…" : "Confirm cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
