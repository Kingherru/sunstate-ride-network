import {useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {DsButton} from '@/components/ds/controls';
import {CheckoutAcknowledgment} from '@/components/payments/CheckoutAcknowledgment';
import {getSettlementPaymentQuote,type PaymentQuote} from '@/lib/network-settlement-payments.functions';
import type {SettlementRow} from '@/lib/network-settlements.functions';
import {usePortalPreview} from './preview-data';
export function SettlementPayment({row,payable}: {row:SettlementRow;payable:boolean}) {
 const preview=usePortalPreview();const quote=useServerFn(getSettlementPaymentQuote);const [q,setQ]=useState<PaymentQuote|null>(null);const [accepted,setAccepted]=useState(false);const [error,setError]=useState('');const money=(c:number)=>`$${(c/100).toFixed(2)}`;
 return <section className="rounded-ds border border-ds-border bg-ds-surface p-4 space-y-3"><h3 className="ds-label uppercase">Referral funding review</h3><p className="ds-body">Payer: sending provider business · Merchant: MY FLORIDA NEMT · USD · One-time funding.</p><DsButton variant="secondary" disabled={preview.active||!payable} onClick={async()=>{const r=await quote({data:{settlementId:row.id,method:'card',environment:'sandbox'}});setAccepted(false);if('error' in r)setError(r.error ?? 'Review unavailable.');else setQ(r.quote);}}>Review configured amounts</DsButton>{q&&<dl className="ds-body space-y-1"><div>Receiver compensation: {money(q.receiver_payout_cents)}</div><div>2% Network fee: {money(q.network_fee_cents)}</div><div>Processing recovery: {money(q.processing_fee_cents)}{q.sandbox_estimate?' (synthetic estimate, not approved live rate)':''}</div><div>Total: {money(q.total_cents)}</div></dl>}<CheckoutAcknowledgment accepted={accepted} onChange={setAccepted} disabled={!q||preview.active}/><DsButton disabled>Funding unavailable</DsButton><p className="ds-support">No funding, payment form or transfer is enabled. Review/correct the controlled offer before any later acceptance.</p>{error&&<p role="alert" className="ds-support">{error}</p>}</section>;
}
