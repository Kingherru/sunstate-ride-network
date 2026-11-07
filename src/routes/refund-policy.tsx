import { createFileRoute } from '@tanstack/react-router';
import { LegalPage } from '@/components/public/LegalPage';
import { pageHead } from '@/components/public/page-kit';
import { REFUND_SECTIONS, POLICY_EFFECTIVE_DATE, PAYMENT_POLICY_VERSION, TERMS_VERSION_URL } from '@/lib/payment-policy';
export const Route = createFileRoute('/refund-policy')({
  validateSearch: (search: Record<string, unknown>): { version?: string } => ({ version: typeof search.version === 'string' ? search.version : undefined }),
  head: () => pageHead('/refund-policy', 'Refund & Payment Reversal Policy | MY FLORIDA NEMT', 'Versioned refund, cancellation, fee responsibility, dispute and reversal rules for trip invoices, Network funding, subscriptions and training.'),
  component: RefundPolicy,
});
function RefundPolicy() {
  const { version } = Route.useSearch();
  const valid = version === undefined || version === PAYMENT_POLICY_VERSION;
  return <LegalPage crumb="Refund & Payment Reversal Policy" title={valid ? 'Refund & Payment Reversal Policy' : 'Policy version unavailable'} intro={valid ? <>Version {PAYMENT_POLICY_VERSION}. Read alongside the <a className="underline" href={TERMS_VERSION_URL}>Terms and Conditions</a>. Exact product-specific refund eligibility remains subject to separately approved purchase terms.</> : 'This version is not available. No other version is substituted for your acceptance.'} dateLabel="Effective" date={POLICY_EFFECTIVE_DATE} sections={valid ? REFUND_SECTIONS.map(s => ({ id: s.id, h: s.h, body: <>{s.paragraphs.map(p => <p key={p}>{p}</p>)}</> })) : []}/>;
}