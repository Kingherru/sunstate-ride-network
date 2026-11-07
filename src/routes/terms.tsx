import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/LegalPage";
import { pageHead } from "@/components/public/page-kit";
import { TERMS_PAYMENT_SECTIONS, TERMS_VERSION, POLICY_EFFECTIVE_DATE, REFUND_VERSION_URL } from "@/lib/payment-policy";
export const Route = createFileRoute("/terms")({
  validateSearch: (search: Record<string, unknown>): { version?: string } => ({ version: typeof search.version === 'string' ? search.version : undefined }),
  head: () => pageHead("/terms", "Terms and Conditions | MY FLORIDA NEMT", "Platform and provider responsibilities, recurring billing, Network fees, holds, disputes and versioned electronic purchase consent."),
  component: Terms,
});
function Terms() {
  const { version } = Route.useSearch();
  const valid = version === undefined || version === TERMS_VERSION;
  return <LegalPage crumb="Terms and Conditions" title={valid ? "Terms and Conditions" : "Terms version unavailable"} intro={valid ? <>Version {TERMS_VERSION}. These terms incorporate the <a className="underline" href={REFUND_VERSION_URL}>Refund &amp; Payment Reversal Policy</a>. Retain both with your purchase review.</> : 'This version is unavailable. Another version is not substituted.'} dateLabel="Effective" date={POLICY_EFFECTIVE_DATE} sections={valid ? TERMS_PAYMENT_SECTIONS.map(s => ({ id: s.id, h: s.h, body: <>{s.paragraphs.map(p => <p key={p}>{p}</p>)}</> })) : []}/>;
}
