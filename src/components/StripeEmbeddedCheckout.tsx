import { useState } from 'react';
import { DsButton } from '@/components/ds/controls';
import { CheckoutAcknowledgment } from '@/components/payments/CheckoutAcknowledgment';
interface Props { priceId: string; customerEmail?: string; userId?: string; returnUrl?: string; metadata?: Record<string,string>; includeNetworkAddon?: boolean; }
/** Legacy entry points share clickwrap, but cannot mount a payment form without authoritative final review. */
export function StripeEmbeddedCheckout(_props: Props) {
  const [accepted,setAccepted]=useState(false);
  return <div className="theme-portal space-y-4"><p className="ds-body">Payment review unavailable: exact amount, payer, merchant, recurring status, fees and approved product-specific purchase terms are required. No payment form is opened.</p><CheckoutAcknowledgment accepted={accepted} onChange={setAccepted}/><DsButton disabled>Payment unavailable</DsButton></div>;
}
