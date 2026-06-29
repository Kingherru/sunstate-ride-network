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

export function SavedCards() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["saved-cards"], queryFn: () => listSavedPaymentMethods() });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-extrabold">Saved payment methods</h3>
          <p className="text-xs text-muted-foreground">
            Card details are stored by Stripe — never on our servers. Only you can see or use them.
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
            onDone={() => { setAdding(false); setClientSecret(null); qc.invalidateQueries({ queryKey: ["saved-cards"] }); }}
            onCancel={() => { setAdding(false); setClientSecret(null); }}
          />
        </Elements>
      )}
    </div>
  );
}

function AddCardForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [makeDefault, setMakeDefault] = useState(true);

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
      const r = await recordSavedPaymentMethod({
        data: { environment: getStripeEnvironment(), payment_method_id: pmId, make_default: makeDefault },
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
