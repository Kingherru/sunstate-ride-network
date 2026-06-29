import { useState } from "react";
import { toast } from "sonner";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { payForConfirmedTrip } from "@/lib/saved-payments.functions";

interface Props {
  rideRequestId: string;
  amountCents: number;
  paymentStatus?: string | null;
  onPaid?: () => void;
}

/**
 * One-click pay button for a confirmed ride request.
 * - Charges the user's default saved card via Stripe.
 * - If 3DS authentication is required, opens a Stripe Elements modal to finish.
 */
export function PayTripButton({ rideRequestId, amountCents, paymentStatus, onPaid }: Props) {
  const [busy, setBusy] = useState(false);
  const [actionSecret, setActionSecret] = useState<string | null>(null);

  if (paymentStatus === "paid") {
    return <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-sm uppercase">Paid</span>;
  }

  async function onPay() {
    setBusy(true);
    try {
      const r = await payForConfirmedTrip({
        data: { ride_request_id: rideRequestId, environment: getStripeEnvironment() },
      });
      if ("error" in r) {
        if (r.requires_action?.client_secret) {
          setActionSecret(r.requires_action.client_secret);
          return;
        }
        toast.error(r.error);
        return;
      }
      toast.success("Payment successful");
      onPaid?.();
    } catch (e: any) {
      toast.error(e.message ?? "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={onPay}
        disabled={busy}
        className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-sm hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Processing…" : `Pay $${(amountCents / 100).toFixed(2)}`}
      </button>
      {actionSecret && (
        <Elements stripe={getStripe()} options={{ clientSecret: actionSecret, appearance: { theme: "stripe" } }}>
          <ConfirmModal
            onClose={() => setActionSecret(null)}
            onDone={() => { setActionSecret(null); onPaid?.(); }}
          />
        </Elements>
      )}
    </>
  );
}

function ConfirmModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (error) { toast.error(error.message ?? "Payment failed"); return; }
      if (paymentIntent?.status === "succeeded") {
        toast.success("Payment successful");
        onDone();
      } else {
        toast.message(`Status: ${paymentIntent?.status ?? "pending"}`);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="bg-card rounded-sm max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-extrabold">Confirm payment</h3>
        <PaymentElement options={{ layout: "tabs" }} />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="text-sm font-bold text-muted-foreground hover:underline">Cancel</button>
          <button type="submit" disabled={busy || !stripe} className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-sm hover:bg-emerald-700 disabled:opacity-50">
            {busy ? "Processing…" : "Pay now"}
          </button>
        </div>
      </form>
    </div>
  );
}
