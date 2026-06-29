import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getMyRequest,
  cancelMyRequest,
  rescheduleMyRequest,
} from "@/lib/requests.functions";

export const Route = createFileRoute("/_authenticated/requests/$id")({
  head: () => ({
    meta: [
      { title: "Ride Request Details — Florida NEMT" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestDetailPage,
});

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

function paymentBadge(status: string) {
  const map: Record<string, string> = {
    paid: "bg-green-100 text-green-900 border-green-300",
    unpaid: "bg-zinc-100 text-zinc-700 border-zinc-300",
    pending: "bg-amber-100 text-amber-900 border-amber-300",
    refunded: "bg-purple-100 text-purple-900 border-purple-300",
    failed: "bg-red-100 text-red-900 border-red-300",
  };
  return map[status?.toLowerCase()] ?? "bg-zinc-100 text-zinc-700 border-zinc-300";
}

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function RequestDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const get = useServerFn(getMyRequest);
  const cancel = useServerFn(cancelMyRequest);
  const reschedule = useServerFn(rescheduleMyRequest);

  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [confirm, setConfirm] = useState<null | "single" | "next" | "all_future">(null);
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["ride-request", id],
    queryFn: async () => {
      const r = await get({ data: { id } });
      if (!r.ok) throw new Error(r.error);
      return r.row;
    },
  });

  const cancelM = useMutation({
    mutationFn: async (vars: { scope: "single" | "next" | "all_future"; reason: string }) => {
      const r = await cancel({ data: { id, scope: vars.scope, reason: vars.reason } });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      toast.success(
        r.scope === "next"
          ? "Next occurrence skipped."
          : r.scope === "all_future"
            ? "Recurring series ended."
            : "Ride request canceled."
      );
      setConfirm(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["ride-request", id] });
      void qc.invalidateQueries({ queryKey: ["my-ride-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleM = useMutation({
    mutationFn: async (input: {
      pickupDate: string;
      pickupTime: string;
      pickupAddress: string;
      pickupCity: string;
      specialInstructions: string;
    }) => {
      const r = await reschedule({ data: { id, ...input } });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Ride rescheduled.");
      setMode("view");
      void qc.invalidateQueries({ queryKey: ["ride-request", id] });
      void qc.invalidateQueries({ queryKey: ["my-ride-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <main className="mx-auto max-w-3xl px-4 py-10">Loading…</main>;
  if (q.isError || !q.data)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-red-700">Could not load that request.</p>
        <Link to="/requests" className="mt-3 inline-block text-sm underline">
          ← Back to my requests
        </Link>
      </main>
    );

  const r = q.data;
  const s = (r.status ?? "").toLowerCase();
  const isTerminal = ["completed", "canceled", "cancelled"].includes(s);
  const canReschedule = !isTerminal && s !== "in_progress";
  const isRecurring = !!r.recurrence_rule;
  const exceptions = (r.recurrence_exceptions ?? []) as string[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <button
          onClick={() => navigate({ to: "/requests" })}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Back to my requests
        </button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-navy,#0b1d3a)]">Ride Request</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge(r.status)}`}>
              {r.status}
            </span>
            <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${paymentBadge(r.payment_status ?? "unpaid")}`}>
              Payment: {r.payment_status ?? "unpaid"}
            </span>
            {isRecurring && (
              <span className="inline-block rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-900">
                Recurring
              </span>
            )}
            {r.round_trip && (
              <span className="inline-block rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-900">
                Round trip
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReschedule && mode === "view" && (
            <button
              onClick={() => setMode("reschedule")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Reschedule
            </button>
          )}
          {!isTerminal && (
            <button
              onClick={() => setConfirm(isRecurring ? "next" : "single")}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Cancel
            </button>
          )}
        </div>
      </header>

      {mode === "view" ? (
        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Route">
            <Row label="When">
              {r.pickup_date} at {r.pickup_time}
            </Row>
            <Row label="Pickup">
              {r.pickup_address}
              <br />
              <span className="text-zinc-600">{r.pickup_city}</span>
            </Row>
            <Row label="Dropoff">
              {r.dropoff_address}
              <br />
              <span className="text-zinc-600">{r.dropoff_city}</span>
            </Row>
            <Row label="Transport">{r.transport_type}</Row>
            {isRecurring && (
              <>
                <Row label="Recurrence">{r.recurrence_rule}</Row>
                {r.recurrence_end_date && <Row label="Ends">{r.recurrence_end_date}</Row>}
                {exceptions.length > 0 && (
                  <Row label="Skipped">{exceptions.join(", ")}</Row>
                )}
              </>
            )}
          </Card>

          <Card title="Patient">
            <Row label="Name">
              {r.patient_first_name} {r.patient_last_name}
            </Row>
            <Row label="Phone">{r.patient_phone}</Row>
            {r.patient_email && <Row label="Email">{r.patient_email}</Row>}
            {r.mobility_notes && <Row label="Mobility">{r.mobility_notes}</Row>}
            {r.special_instructions && <Row label="Instructions">{r.special_instructions}</Row>}
          </Card>

          <Card title="Payment">
            <Row label="Status">{r.payment_status ?? "unpaid"}</Row>
            <Row label="Amount">{fmtMoney(r.payment_amount_cents)}</Row>
          </Card>

          <Card title="Provider notes">
            {r.provider_notes ? (
              <p className="whitespace-pre-wrap text-sm text-zinc-800">{r.provider_notes}</p>
            ) : (
              <p className="text-sm text-zinc-500">No notes from the provider yet.</p>
            )}
            {r.canceled_at && (
              <p className="mt-3 text-xs text-zinc-500">
                Canceled {new Date(r.canceled_at).toLocaleString()}
                {r.cancel_reason ? ` — ${r.cancel_reason}` : ""}
              </p>
            )}
          </Card>
        </section>
      ) : (
        <RescheduleForm
          initial={{
            pickupDate: r.pickup_date,
            pickupTime: r.pickup_time,
            pickupAddress: r.pickup_address,
            pickupCity: r.pickup_city,
            specialInstructions: r.special_instructions ?? "",
          }}
          submitting={rescheduleM.isPending}
          onCancel={() => setMode("view")}
          onSubmit={(v) => rescheduleM.mutate(v)}
        />
      )}

      {confirm && (
        <CancelDialog
          isRecurring={isRecurring}
          scope={confirm}
          setScope={setConfirm}
          reason={reason}
          setReason={setReason}
          submitting={cancelM.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => cancelM.mutate({ scope: confirm, reason })}
        />
      )}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-900">{children}</div>
    </div>
  );
}

function RescheduleForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: {
    pickupDate: string;
    pickupTime: string;
    pickupAddress: string;
    pickupCity: string;
    specialInstructions: string;
  };
  onSubmit: (v: typeof initial) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [v, setV] = useState(initial);
  return (
    <form
      className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <h2 className="text-lg font-semibold text-zinc-900">Reschedule pickup</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Updating these details will notify the provider and re-confirm your ride.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Pickup date">
          <input
            type="date"
            required
            value={v.pickupDate}
            onChange={(e) => setV({ ...v, pickupDate: e.target.value })}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Pickup time">
          <input
            type="time"
            required
            value={v.pickupTime}
            onChange={(e) => setV({ ...v, pickupTime: e.target.value })}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Pickup address" wide>
          <input
            type="text"
            required
            value={v.pickupAddress}
            onChange={(e) => setV({ ...v, pickupAddress: e.target.value })}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Pickup city">
          <input
            type="text"
            required
            value={v.pickupCity}
            onChange={(e) => setV({ ...v, pickupCity: e.target.value })}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Special instructions" wide>
          <textarea
            rows={3}
            maxLength={1000}
            value={v.specialInstructions}
            onChange={(e) => setV({ ...v, specialInstructions: e.target.value })}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Discard
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[var(--brand-orange,#f47b20)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function CancelDialog({
  isRecurring,
  scope,
  setScope,
  reason,
  setReason,
  submitting,
  onClose,
  onConfirm,
}: {
  isRecurring: boolean;
  scope: "single" | "next" | "all_future";
  setScope: (s: "single" | "next" | "all_future") => void;
  reason: string;
  setReason: (s: string) => void;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-zinc-900">
          {isRecurring ? "Cancel a recurring ride" : "Cancel this ride request?"}
        </h2>
        {isRecurring ? (
          <fieldset className="mt-4 space-y-2">
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-3 hover:bg-zinc-50">
              <input
                type="radio"
                name="scope"
                checked={scope === "next"}
                onChange={() => setScope("next")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-zinc-900">Only the next trip</span>
                <span className="block text-xs text-zinc-600">
                  Skip the upcoming pickup date. Future trips in the series continue as scheduled.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-zinc-200 p-3 hover:bg-zinc-50">
              <input
                type="radio"
                name="scope"
                checked={scope === "all_future"}
                onChange={() => setScope("all_future")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-zinc-900">All future trips</span>
                <span className="block text-xs text-zinc-600">
                  End the recurring series now. No further trips will be scheduled.
                </span>
              </span>
            </label>
          </fieldset>
        ) : (
          <p className="mt-1 text-sm text-zinc-600">The provider will be notified.</p>
        )}

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
            onClick={onClose}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Keep
          </button>
          <button
            disabled={submitting}
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {submitting
              ? "Working…"
              : scope === "next"
                ? "Skip next trip"
                : scope === "all_future"
                  ? "End series"
                  : "Confirm cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
