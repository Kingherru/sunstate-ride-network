import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { updateTripStatus, updateTripDetails } from "@/lib/trips.functions";
import { formatTime12, formatDateLong, formatIsoDateTime12 } from "@/lib/time-format";

type Row = {
  id: string;
  display_id?: string | null;
  status: string;
  reservation_state?: string | null;
  pickup_address: string;
  pickup_address_details?: string | null;
  pickup_city: string | null;
  pickup_zip?: string | null;
  dropoff_address: string;
  dropoff_city: string | null;
  dropoff_zip?: string | null;
  pickup_date: string;
  pickup_time: string;
  appointment_time: string | null;
  return_pickup_time: string | null;
  return_dropoff_time: string | null;
  return_date: string | null;
  round_trip: boolean | null;
  trip_type?: string | null;
  transport_type: string | null;
  patient_first_name: string;
  patient_last_name: string;
  patient_phone?: string | null;
  patient_email?: string | null;
  service_level: string | null;
  needs_wheelchair: boolean | null;
  estimated_cost_cents: number | null;
  estimated_duration_seconds?: number | null;
  distance_miles?: number | null;
  payer: string | null;
  medicaid_number: string | null;
  medicaid_plan: string | null;
  authorization_number?: string | null;
  diagnosis_code?: string | null;
  special_instructions?: string | null;
  mobility_notes?: string | null;
  provider_notes?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  created_at?: string | null;
  unconfirmed_expires_at?: string | null;
};

function mobilityLabel(r: Row) {
  const t = String(r.transport_type ?? "").toLowerCase();
  if (t === "stretcher" || String(r.service_level ?? "").toLowerCase() === "stretcher") return "Stretcher";
  if (t === "wheelchair" || r.needs_wheelchair) return "Wheelchair";
  return "Ambulatory";
}

function StatusBadge({ state, status }: { state?: string | null; status: string }) {
  const s = (state || status).toLowerCase();
  const map: Record<string, string> = {
    unconfirmed: "bg-amber-100 text-amber-900 border-amber-300",
    booked: "bg-emerald-100 text-emerald-900 border-emerald-300",
    past: "bg-slate-100 text-slate-700 border-slate-300",
    history: "bg-slate-100 text-slate-700 border-slate-300",
  };
  return (
    <span className={`inline-flex items-center border text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm ${map[s] ?? "bg-muted text-foreground border-border"}`}>
      {s}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground break-words mt-0.5">{children ?? "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border rounded-sm p-4">
      <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-foreground mb-3">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-border rounded-sm px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block md:col-span-2">
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">{label}</div>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full text-sm border border-border rounded-sm px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

export function ReservationReviewDialog({
  row,
  open,
  onOpenChange,
  canApprove,
}: {
  row: Row;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canApprove: boolean;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateTripStatus);
  const saveDetails = useServerFn(updateTripDetails);
  const [busy, setBusy] = useState<"accept" | "decline" | "save" | null>(null);
  const [editing, setEditing] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const isRound = !!row.round_trip;
  const isDelivery = String(row.trip_type ?? "").toLowerCase() === "medical_delivery";
  const isUnconfirmed = String(row.reservation_state ?? "").toLowerCase() === "unconfirmed";

  // Editable draft mirrors current row values; only sent fields are patched.
  const [draft, setDraft] = useState(() => ({
    pickup_address: row.pickup_address ?? "",
    pickup_address_details: row.pickup_address_details ?? "",
    pickup_city: row.pickup_city ?? "",
    pickup_zip: row.pickup_zip ?? "",
    dropoff_address: row.dropoff_address ?? "",
    dropoff_city: row.dropoff_city ?? "",
    dropoff_zip: row.dropoff_zip ?? "",
    pickup_date: row.pickup_date ?? "",
    pickup_time: row.pickup_time ?? "",
    appointment_time: row.appointment_time ?? "",
    return_date: row.return_date ?? "",
    return_pickup_time: row.return_pickup_time ?? "",
    return_dropoff_time: row.return_dropoff_time ?? "",
    patient_phone: row.patient_phone ?? "",
    patient_email: row.patient_email ?? "",
    emergency_contact_name: row.emergency_contact_name ?? "",
    emergency_contact_phone: row.emergency_contact_phone ?? "",
    special_instructions: row.special_instructions ?? "",
    mobility_notes: row.mobility_notes ?? "",
    provider_notes: row.provider_notes ?? "",
    payer: row.payer ?? "",
  }));

  const expiresLabel = useMemo(() => {
    const iso = row.unconfirmed_expires_at ?? null;
    if (!iso) return null;
    const dt = new Date(iso);
    const days = Math.max(0, Math.ceil((dt.getTime() - Date.now()) / 86400000));
    return { text: formatIsoDateTime12(iso), days };
  }, [row.unconfirmed_expires_at]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reservations-by-state"] });
    qc.invalidateQueries({ queryKey: ["my-trips"] });
    qc.invalidateQueries({ queryKey: ["unread-counts"] });
  };

  async function saveEdits() {
    setBusy("save");
    try {
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(draft) as (keyof typeof draft)[]) {
        const v = draft[k];
        const prev = (row as any)[k] ?? "";
        if (String(v ?? "") !== String(prev ?? "")) patch[k] = v === "" ? null : v;
      }
      if (Object.keys(patch).length === 0) {
        setEditing(false);
        return;
      }
      await saveDetails({ data: { trip_id: row.id, patch: patch as any } });
      toast.success("Reservation updated");
      invalidate();
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save changes");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    setBusy("accept");
    try {
      await update({ data: { trip_id: row.id, status: "accepted" } });
      toast.success("Reservation approved — moved to Booked");
      invalidate();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not approve reservation");
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    setBusy("decline");
    try {
      await update({ data: { trip_id: row.id, status: "declined", reason: declineReason.trim() || null } });
      toast.success("Reservation declined");
      invalidate();
      setDeclineOpen(false);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not decline reservation");
    } finally {
      setBusy(null);
    }
  }

  const patientName = [row.patient_first_name, row.patient_last_name].filter(Boolean).join(" ") || "Unnamed";
  const priceUsd = row.estimated_cost_cents != null ? `$${(row.estimated_cost_cents / 100).toFixed(2)}` : "—";
  const miles = row.distance_miles != null ? `${Number(row.distance_miles).toFixed(1)} mi` : "—";
  const durMin = row.estimated_duration_seconds ? `${Math.round(row.estimated_duration_seconds / 60)} min` : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <DialogTitle className="text-lg">Reservation Review</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs">{row.display_id ?? row.id.slice(0, 8)}</span>
                <span>·</span>
                <span>{patientName}</span>
                <StatusBadge state={row.reservation_state} status={row.status} />
                {isRound && <span className="text-[10px] font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-sm">Round Trip</span>}
                {isDelivery && <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-sm">Delivery</span>}
              </DialogDescription>
            </div>
            {isUnconfirmed && (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="text-xs font-bold border border-border px-3 py-1.5 rounded-sm hover:bg-muted"
              >
                {editing ? "Cancel edits" : "Edit reservation"}
              </button>
            )}
          </div>
          {isUnconfirmed && expiresLabel && (
            <div className="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2">
              Unconfirmed reservations remain editable for 60 days. Expires <strong>{expiresLabel.text}</strong> ({expiresLabel.days} day{expiresLabel.days === 1 ? "" : "s"} left).
            </div>
          )}
        </DialogHeader>

        {!editing ? (
          <div className="space-y-4 py-2">
            <Section title="Trip Summary">
              <Field label="Trip ID"><span className="font-mono text-xs">{row.display_id ?? row.id.slice(0, 8)}</span></Field>
              <Field label="Trip Type">{isDelivery ? "Medical delivery" : (isRound ? "Round trip" : "One way")}</Field>
              <Field label="Transportation">{mobilityLabel(row)}</Field>
              <Field label="Service Level">{row.service_level ?? "—"}</Field>
              <Field label="Estimated Price">{priceUsd}</Field>
              <Field label="Estimated Distance">{miles}</Field>
              <Field label="Estimated Travel Time">{durMin}</Field>
              <Field label="Created">{formatIsoDateTime12(row.created_at)}</Field>
            </Section>

            <Section title="Pickup & Drop-off">
              <Field label="Pickup Address">
                {row.pickup_address}
                {row.pickup_address_details && <div className="text-xs text-muted-foreground">{row.pickup_address_details}</div>}
                <div className="text-xs text-muted-foreground">{[row.pickup_city, row.pickup_zip].filter(Boolean).join(", ")}</div>
              </Field>
              <Field label="Drop-off Address">
                {row.dropoff_address}
                <div className="text-xs text-muted-foreground">{[row.dropoff_city, row.dropoff_zip].filter(Boolean).join(", ")}</div>
              </Field>
              <Field label="Pickup Date">{formatDateLong(row.pickup_date)}</Field>
              <Field label="Pickup Time">{formatTime12(row.pickup_time)}</Field>
              {row.appointment_time && <Field label="Appointment Time">{formatTime12(row.appointment_time)}</Field>}
              {isRound && (
                <>
                  <Field label="Return Date">{formatDateLong(row.return_date || row.pickup_date)}</Field>
                  <Field label="Return Pickup Time">{formatTime12(row.return_pickup_time)}</Field>
                  <Field label="Return Drop-off Time">{formatTime12(row.return_dropoff_time)}</Field>
                </>
              )}
            </Section>

            <Section title={isDelivery ? "Delivery Contact" : "Passenger & Contact"}>
              <Field label="Name">{patientName}</Field>
              <Field label="Phone">{row.patient_phone ?? "—"}</Field>
              <Field label="Email">{row.patient_email ?? "—"}</Field>
              <Field label="Emergency Contact">
                {row.emergency_contact_name ?? "—"}
                {row.emergency_contact_phone && <div className="text-xs text-muted-foreground">{row.emergency_contact_phone}</div>}
              </Field>
            </Section>

            <Section title="Payer & Authorization">
              <Field label="Payer">{row.payer ?? "—"}</Field>
              {row.medicaid_number && <Field label="Medicaid #">{row.medicaid_number}</Field>}
              {row.medicaid_plan && <Field label="Medicaid Plan">{row.medicaid_plan}</Field>}
              {row.authorization_number && <Field label="Authorization #">{row.authorization_number}</Field>}
              {row.diagnosis_code && <Field label="Diagnosis Code">{row.diagnosis_code}</Field>}
            </Section>

            {(row.special_instructions || row.mobility_notes || row.provider_notes) && (
              <Section title="Notes & Special Instructions">
                {row.special_instructions && <div className="md:col-span-2"><Field label="Special Instructions">{row.special_instructions}</Field></div>}
                {row.mobility_notes && <div className="md:col-span-2"><Field label="Mobility Notes">{row.mobility_notes}</Field></div>}
                {row.provider_notes && <div className="md:col-span-2"><Field label="Provider Notes">{row.provider_notes}</Field></div>}
              </Section>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Section title="Pickup & Drop-off">
              <Input label="Pickup Address" value={draft.pickup_address} onChange={(v) => setDraft({ ...draft, pickup_address: v })} />
              <Input label="Drop-off Address" value={draft.dropoff_address} onChange={(v) => setDraft({ ...draft, dropoff_address: v })} />
              <Input label="Pickup City" value={draft.pickup_city} onChange={(v) => setDraft({ ...draft, pickup_city: v })} />
              <Input label="Drop-off City" value={draft.dropoff_city} onChange={(v) => setDraft({ ...draft, dropoff_city: v })} />
              <Input label="Pickup ZIP" value={draft.pickup_zip} onChange={(v) => setDraft({ ...draft, pickup_zip: v })} />
              <Input label="Drop-off ZIP" value={draft.dropoff_zip} onChange={(v) => setDraft({ ...draft, dropoff_zip: v })} />
              <Input label="Pickup Date" type="date" value={draft.pickup_date} onChange={(v) => setDraft({ ...draft, pickup_date: v })} />
              <Input label="Pickup Time" type="time" value={String(draft.pickup_time).slice(0, 5)} onChange={(v) => setDraft({ ...draft, pickup_time: v })} />
              <Input label="Appointment Time" type="time" value={String(draft.appointment_time).slice(0, 5)} onChange={(v) => setDraft({ ...draft, appointment_time: v })} />
              {isRound && (
                <>
                  <Input label="Return Date" type="date" value={draft.return_date} onChange={(v) => setDraft({ ...draft, return_date: v })} />
                  <Input label="Return Pickup Time" type="time" value={String(draft.return_pickup_time).slice(0, 5)} onChange={(v) => setDraft({ ...draft, return_pickup_time: v })} />
                  <Input label="Return Drop-off Time" type="time" value={String(draft.return_dropoff_time).slice(0, 5)} onChange={(v) => setDraft({ ...draft, return_dropoff_time: v })} />
                </>
              )}
            </Section>

            <Section title="Contact">
              <Input label="Phone" value={draft.patient_phone} onChange={(v) => setDraft({ ...draft, patient_phone: v })} />
              <Input label="Email" type="email" value={draft.patient_email} onChange={(v) => setDraft({ ...draft, patient_email: v })} />
              <Input label="Emergency Contact Name" value={draft.emergency_contact_name} onChange={(v) => setDraft({ ...draft, emergency_contact_name: v })} />
              <Input label="Emergency Contact Phone" value={draft.emergency_contact_phone} onChange={(v) => setDraft({ ...draft, emergency_contact_phone: v })} />
              <Input label="Payer" value={draft.payer} onChange={(v) => setDraft({ ...draft, payer: v })} />
            </Section>

            <Section title="Notes">
              <Textarea label="Special Instructions" value={draft.special_instructions} onChange={(v) => setDraft({ ...draft, special_instructions: v })} />
              <Textarea label="Mobility Notes" value={draft.mobility_notes} onChange={(v) => setDraft({ ...draft, mobility_notes: v })} />
              <Textarea label="Provider Notes (internal)" value={draft.provider_notes} onChange={(v) => setDraft({ ...draft, provider_notes: v })} />
            </Section>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm font-bold border border-border px-4 py-2 rounded-sm hover:bg-muted"
          >
            Close
          </button>
          <div className="flex flex-col sm:flex-row gap-2">
            {editing && (
              <button
                type="button"
                disabled={busy === "save"}
                onClick={saveEdits}
                className="text-sm font-bold bg-primary text-primary-foreground px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-60"
              >
                {busy === "save" ? "Saving…" : "Save changes"}
              </button>
            )}
            {!editing && canApprove && isUnconfirmed && (
              <>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => setDeclineOpen(true)}
                  className="text-sm font-bold text-white bg-red-600 border border-red-700 px-4 py-2 rounded-sm hover:bg-red-700 disabled:opacity-60"
                >
                  Decline
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={approve}
                  className="text-sm font-bold text-white bg-emerald-600 border border-emerald-700 px-4 py-2 rounded-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy === "accept" ? "Approving…" : "Approve reservation"}
                </button>
              </>
            )}
          </div>
        </DialogFooter>

        {declineOpen && (
          <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Decline reservation</DialogTitle>
                <DialogDescription>Provide a short reason so the requester and dispatch are notified.</DialogDescription>
              </DialogHeader>
              <textarea
                autoFocus
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={4}
                placeholder="Reason for decline (e.g., no vehicle available, out of service area)"
                className="w-full text-sm border border-border rounded-sm px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => setDeclineOpen(false)}
                  className="text-sm font-bold border border-border px-4 py-2 rounded-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy === "decline"}
                  onClick={decline}
                  className="text-sm font-bold text-white bg-red-600 border border-red-700 px-4 py-2 rounded-sm hover:bg-red-700 disabled:opacity-60"
                >
                  {busy === "decline" ? "Declining…" : "Confirm decline"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
