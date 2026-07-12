import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import {
  listMyPayers,
  createPayer,
  updatePayer,
  deletePayer,
  createPayerSetupIntent,
  recordPayerPaymentMethod,
  listPayerCards,
  deletePayerCard,
} from "@/lib/payers.functions";

export function PayersPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-payers"], queryFn: () => listMyPayers() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const create = useMutation({
    mutationFn: (input: any) => createPayer({ data: input }),
    onSuccess: (r: any) => {
      if ("error" in r) return toast.error(r.error);
      toast.success("Payer added");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["my-payers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deletePayer({ data: { id } }),
    onSuccess: () => { toast.success("Payer removed"); qc.invalidateQueries({ queryKey: ["my-payers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-extrabold">Payers</h3>
          <p className="text-xs text-muted-foreground">
            Add third parties who cover trip costs. Any card you save is locked to that payer — it can only be charged for trips assigned to them.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90"
          >
            Add payer
          </button>
        )}
      </div>

      {creating && (
        <PayerForm
          submitting={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(v) => create.mutate(v)}
        />
      )}

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <ul className="space-y-2">
        {(q.data ?? []).map((p: any) => (
          <li key={p.id} className="border border-border rounded-sm bg-card">
            <div className="p-3 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-bold">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[p.email, p.phone].filter(Boolean).join(" • ") || "No contact info"}
                </div>
              </div>
              <div className="flex gap-3 text-sm font-bold">
                <button onClick={() => setOpenId(openId === p.id ? null : p.id)} className="text-primary hover:underline">
                  {openId === p.id ? "Close" : "Manage cards"}
                </button>
                <button
                  onClick={() => { if (confirm(`Remove payer "${p.name}"? Their cards will be detached.`)) del.mutate(p.id); }}
                  className="text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
            {openId === p.id && (
              <div className="border-t border-border p-3">
                <PayerCards payerId={p.id} payerName={p.name} />
              </div>
            )}
          </li>
        ))}
        {!q.isLoading && (q.data ?? []).length === 0 && !creating && (
          <li className="text-sm text-muted-foreground">No payers yet.</li>
        )}
      </ul>
    </div>
  );
}

function PayerForm({
  submitting,
  onCancel,
  onSubmit,
  initial,
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (v: { name: string; email?: string; phone?: string; notes?: string }) => void;
  initial?: { name?: string; email?: string; phone?: string; notes?: string };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ name, email, phone, notes }); }}
      className="border border-border rounded-sm p-4 bg-card space-y-3"
    >
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Name *</span>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            className="border border-border rounded-sm px-3 py-2 bg-background" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="border border-border rounded-sm px-3 py-2 bg-background" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            className="border border-border rounded-sm px-3 py-2 bg-background" />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            className="border border-border rounded-sm px-3 py-2 bg-background" />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50">
          {submitting ? "Saving…" : "Save payer"}
        </button>
        <button type="button" onClick={onCancel}
          className="text-sm font-bold text-muted-foreground hover:underline">Cancel</button>
      </div>
    </form>
  );
}

function PayerCards({ payerId, payerName }: { payerId: string; payerName: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["payer-cards", payerId], queryFn: () => listPayerCards({ data: { payer_id: payerId } }) });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const start = useMutation({
    mutationFn: async () => {
      const r = await createPayerSetupIntent({ data: { payer_id: payerId, environment: getStripeEnvironment() } });
      if ("error" in r) throw new Error(r.error);
      return r.clientSecret;
    },
    onSuccess: (cs) => { setClientSecret(cs); setAdding(true); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deletePayerCard({ data: { id } }),
    onSuccess: () => { toast.success("Card removed"); qc.invalidateQueries({ queryKey: ["payer-cards", payerId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Cards saved for <span className="font-bold">{payerName}</span>. Only chargeable when this payer is assigned to a trip.
        </div>
        {!adding && (
          <button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="text-sm bg-secondary font-bold px-3 py-1.5 rounded-sm hover:bg-secondary/80 disabled:opacity-50"
          >
            {start.isPending ? "Loading…" : "Add card"}
          </button>
        )}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading cards…</p>}
      <ul className="space-y-2">
        {(q.data ?? []).map((c: any) => (
          <li key={c.id} className="flex items-center justify-between border border-border rounded-sm p-2 bg-background text-sm">
            <div>
              <span className="font-bold uppercase">{c.brand ?? "card"}</span> •••• {c.last4}
              <span className="text-muted-foreground"> — exp {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}</span>
              {c.is_default && <span className="ml-2 bg-accent/15 text-accent text-xs font-bold uppercase px-2 py-0.5 rounded-sm">Default</span>}
              {c.label && <span className="text-xs text-muted-foreground ml-2">{c.label}</span>}
            </div>
            <button onClick={() => { if (confirm("Remove this card?")) del.mutate(c.id); }} className="text-destructive font-bold hover:underline">Remove</button>
          </li>
        ))}
        {!q.isLoading && (q.data ?? []).length === 0 && !adding && (
          <li className="text-xs text-muted-foreground">No cards on file.</li>
        )}
      </ul>

      {adding && clientSecret && (
        <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "stripe" } }}>
          <AddPayerCardForm
            payerId={payerId}
            onDone={() => { setAdding(false); setClientSecret(null); qc.invalidateQueries({ queryKey: ["payer-cards", payerId] }); }}
            onCancel={() => { setAdding(false); setClientSecret(null); }}
          />
        </Elements>
      )}
    </div>
  );
}

function AddPayerCardForm({
  payerId,
  onDone,
  onCancel,
}: { payerId: string; onDone: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [makeDefault, setMakeDefault] = useState(true);
  const [label, setLabel] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
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
      const r = await recordPayerPaymentMethod({
        data: {
          payer_id: payerId,
          environment: getStripeEnvironment(),
          payment_method_id: pmId,
          make_default: makeDefault,
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
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Label (optional)</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Corporate Amex"
          className="border border-border rounded-sm px-3 py-2 bg-background" />
      </label>
      <PaymentElement options={{ layout: "tabs" }} />
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
        Set as default for this payer
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !stripe}
          className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50">
          {busy ? "Saving…" : "Save card"}
        </button>
        <button type="button" onClick={onCancel}
          className="text-sm font-bold text-muted-foreground hover:underline">Cancel</button>
      </div>
    </form>
  );
}
