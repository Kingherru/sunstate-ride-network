import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import {
  createSetupIntent,
  recordSavedPaymentMethod,
  listSavedPaymentMethods,
  deleteSavedPaymentMethod,
  setDefaultPaymentMethod,
} from "@/lib/saved-payments.functions";
import { listSavedPatients } from "@/lib/saved-patients.functions";

export function SavedCards({ assignToPatient = false }: { assignToPatient?: boolean } = {}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["saved-cards"], queryFn: () => listSavedPaymentMethods() });
  const patientsQ = useQuery({
    queryKey: ["saved-patients"],
    queryFn: () => listSavedPatients(),
    enabled: assignToPatient,
  });
  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async () => {
      const r = await createSetupIntent({ data: { environment: getStripeEnvironment() } });
      if ("error" in r) throw new Error(r.error);
      return r.clientSecret;
    },
    onSuccess: (cs) => { setClientSecret(cs); setAdding(true); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const setDef = useMutation({
    mutationFn: (id: string) => setDefaultPaymentMethod({ data: { id } }),
    onSuccess: () => { toast.success("Default updated"); qc.invalidateQueries({ queryKey: ["saved-cards"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteSavedPaymentMethod({ data: { id } }),
    onSuccess: () => { toast.success("Card removed"); qc.invalidateQueries({ queryKey: ["saved-cards"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const patients = patientsQ.data ?? [];
  const patientLookup = new Map(patients.map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-extrabold">Saved payment methods</h3>
          <p className="text-xs text-muted-foreground">
            Card details are stored by Stripe — never on our servers. {assignToPatient ? "Assign each card to one patient." : "Only you can see or use them."}
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {start.isPending ? "Loading…" : "Add card"}
          </button>
        )}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <ul className="space-y-2">
        {(q.data ?? []).map((c: any) => (
          <li key={c.id} className="flex items-center justify-between border border-border rounded-sm p-3 bg-card">
            <div className="text-sm">
              <span className="font-bold uppercase">{c.brand ?? "card"}</span> •••• {c.last4}
              <span className="text-muted-foreground"> — exp {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}</span>
              {c.is_default && <span className="ml-2 bg-accent/15 text-accent text-xs font-bold uppercase px-2 py-0.5 rounded-sm">Default</span>}
              {(c.label || c.patient_id) && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.patient_id ? `Assigned to ${patientLookup.get(c.patient_id) ?? "patient"}` : null}
                  {c.label ? `${c.patient_id ? " • " : ""}${c.label}` : null}
                </div>
              )}
            </div>
            <div className="flex gap-3 text-sm font-bold">
              {!c.is_default && (
                <button onClick={() => setDef.mutate(c.id)} className="text-primary hover:underline">Set default</button>
              )}
              <button onClick={() => { if (confirm("Remove this card?")) del.mutate(c.id); }} className="text-destructive hover:underline">Remove</button>
            </div>
          </li>
        ))}
        {!q.isLoading && (q.data ?? []).length === 0 && !adding && (
          <li className="text-sm text-muted-foreground">No saved cards yet.</li>
        )}
      </ul>

      {adding && clientSecret && (
        <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
          <AddCardForm
            assignToPatient={assignToPatient}
            patients={patients}
            onDone={() => { setAdding(false); setClientSecret(null); qc.invalidateQueries({ queryKey: ["saved-cards"] }); }}
            onCancel={() => { setAdding(false); setClientSecret(null); }}
          />
        </Elements>
      )}
    </div>
  );
}

function AddCardForm({
  onDone,
  onCancel,
  assignToPatient,
  patients,
}: {
  onDone: () => void;
  onCancel: () => void;
  assignToPatient: boolean;
  patients: any[];
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [makeDefault, setMakeDefault] = useState(true);
  const [patientId, setPatientId] = useState<string>("");
  const [label, setLabel] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (assignToPatient && !patientId) { toast.error("Choose which patient this card belongs to"); return; }
    setBusy(true);
    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (error) { toast.error(error.message ?? "Card failed"); return; }
      if (!setupIntent || setupIntent.status !== "succeeded" || !setupIntent.payment_method) {
        toast.error("Card not saved"); return;
      }
      const pmId = typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method.id;
      const r = await recordSavedPaymentMethod({
        data: {
          environment: getStripeEnvironment(),
          payment_method_id: pmId,
          make_default: makeDefault,
          patient_id: patientId || null,
          label: label || null,
        } as any,
      });
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Card saved");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="border border-border rounded-sm p-4 bg-card space-y-3">
      {assignToPatient && (
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Assign to patient *</span>
            <select
              required
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="border border-border rounded-sm px-3 py-2 bg-background"
            >
              <option value="">Select a saved patient…</option>
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
            {patients.length === 0 && (
              <span className="text-xs text-muted-foreground">Add patients in the Saved Patients tab first.</span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Label (optional)</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Family card" className="border border-border rounded-sm px-3 py-2 bg-background" />
          </label>
        </div>
      )}
      <PaymentElement options={{ layout: "tabs" }} />
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
        Set as default
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !stripe} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50">
          {busy ? "Saving…" : "Save card"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-muted-foreground hover:underline">Cancel</button>
      </div>
    </form>
  );
}
