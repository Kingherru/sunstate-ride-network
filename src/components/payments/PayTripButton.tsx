import {useState} from 'react';
import {DsButton} from '@/components/ds/controls';
import {CheckoutAcknowledgment} from './CheckoutAcknowledgment';
interface Props {rideRequestId:string;amountCents:number;paymentStatus?:string|null;onPaid?:()=>void;}
/** Legacy request payment entry is review-only until authoritative invoice linkage is available. */
export function PayTripButton({amountCents,paymentStatus}:Props){const [accepted,setAccepted]=useState(false);if(paymentStatus==='paid')return <span className="ds-label">Paid</span>;return <section className="space-y-3"><p className="ds-body">Trip estimate: ${(amountCents/100).toFixed(2)} USD. An estimate is not an accepted invoice.</p><p className="ds-support">Exact payer, merchant, provider cancellation/no-show policy and approved fees must be shown on the linked invoice before payment.</p><CheckoutAcknowledgment accepted={accepted} onChange={setAccepted}/><DsButton disabled>Invoice payment unavailable</DsButton></section>;}
