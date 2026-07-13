import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { copyRequestToDates } from "@/lib/requests.functions";

type Entry = {
  pickupDate: string;
  pickupTime: string;
  appointmentTime?: string;
  returnPickupTime?: string;
  returnDropoffTime?: string;
};

type Props = {
  sourceId: string;
  defaultPickupTime?: string;
  defaultAppointmentTime?: string;
  defaultReturnPickupTime?: string;
  defaultReturnDropoffTime?: string;
  isRoundTrip?: boolean;
};

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function CopyTripToDates(props: Props) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ id: string; pickup_date: string; pickup_time: string }[] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const copyFn = useServerFn(copyRequestToDates);

  function addRow() {
    setEntries((prev) => [
      ...prev,
      {
        pickupDate: tomorrowIso(),
        pickupTime: props.defaultPickupTime || "",
        appointmentTime: props.defaultAppointmentTime || "",
        returnPickupTime: props.isRoundTrip ? props.defaultReturnPickupTime || "" : "",
        returnDropoffTime: props.isRoundTrip ? props.defaultReturnDropoffTime || "" : "",
      },
    ]);
  }

  function updateRow(i: number, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function removeRow(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    // basic validation
    for (const e of entries) {
      if (!e.pickupDate || !e.pickupTime) {
        toast.error("Every copy needs a pickup date and pickup time.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await copyFn({ data: { sourceId: props.sourceId, dates: entries } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDone(res.rows as { id: string; pickup_date: string; pickup_time: string }[]);
      toast.success(`Created ${res.rows.length} additional trip${res.rows.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error(err);
      toast.error("Could not copy the trip. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-sm border border-border bg-card p-5 text-left">
        <h3 className="text-lg font-bold mb-2">Copies created</h3>
        <p className="text-sm text-muted mb-3">Each trip has its own Trip ID and enters dispatch independently.</p>
        <ul className="space-y-1 text-sm">
          {done.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3">
              <span className="font-mono">
                #{r.id.slice(0, 8).toUpperCase()} — {r.pickup_date} · {(r.pickup_time || "").slice(0, 5)}
              </span>
              <Link
                to="/requests/$id"
                params={{ id: r.id }}
                className="text-xs font-bold uppercase tracking-wider text-primary hover:underline"
              >
                View →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mt-8 rounded-sm border border-primary/30 bg-primary/5 p-5 text-left">
        <h3 className="text-base font-bold mb-1">Would you like to copy this trip to multiple dates?</h3>
        <p className="text-sm text-muted mb-3">
          We'll duplicate the addresses, passenger, trip type, and instructions. You choose the dates and times —
          each copy becomes its own trip with its own Trip ID.
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            addRow();
          }}
          className="inline-block px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-sm text-xs tracking-wide uppercase"
        >
          Copy to more dates
        </button>
      </div>
    );
  }

  const inputCls =
    "w-full bg-card border border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="mt-8 rounded-sm border border-border bg-card p-5 text-left">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">Copy this trip to more dates</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-bold uppercase tracking-wider text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted mb-4">
        Everything else (addresses, passenger info, trip type, instructions) is copied from the original trip. Update
        anything on the copied trip's details page after submitting if needed.
      </p>

      <div className="space-y-3">
        {entries.map((e, i) => (
          <div key={i} className="rounded-sm border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Copy #{i + 1}</span>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-xs text-destructive hover:underline"
              >
                Remove
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="block font-bold uppercase tracking-widest text-muted mb-1">Pickup date *</span>
                <input
                  type="date"
                  value={e.pickupDate}
                  min={tomorrowIso()}
                  onChange={(ev) => updateRow(i, { pickupDate: ev.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-xs">
                <span className="block font-bold uppercase tracking-widest text-muted mb-1">Pickup time *</span>
                <input
                  type="time"
                  value={e.pickupTime}
                  onChange={(ev) => updateRow(i, { pickupTime: ev.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block text-xs">
                <span className="block font-bold uppercase tracking-widest text-muted mb-1">Appointment time</span>
                <input
                  type="time"
                  value={e.appointmentTime ?? ""}
                  onChange={(ev) => updateRow(i, { appointmentTime: ev.target.value })}
                  className={inputCls}
                />
              </label>
              {props.isRoundTrip && (
                <>
                  <label className="block text-xs">
                    <span className="block font-bold uppercase tracking-widest text-muted mb-1">Return pickup</span>
                    <input
                      type="time"
                      value={e.returnPickupTime ?? ""}
                      onChange={(ev) => updateRow(i, { returnPickupTime: ev.target.value })}
                      className={inputCls}
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="block font-bold uppercase tracking-widest text-muted mb-1">Return drop-off</span>
                    <input
                      type="time"
                      value={e.returnDropoffTime ?? ""}
                      onChange={(ev) => updateRow(i, { returnDropoffTime: ev.target.value })}
                      className={inputCls}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-block px-4 py-2 bg-card border border-border text-foreground font-bold rounded-sm text-xs tracking-wide uppercase"
        >
          + Add another date
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || entries.length === 0}
          className="inline-block px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-sm text-xs tracking-wide uppercase disabled:opacity-60"
        >
          {submitting ? "Creating…" : `Create ${entries.length} trip${entries.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
