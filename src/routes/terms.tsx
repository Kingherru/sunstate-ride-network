import { createFileRoute, redirect } from "@tanstack/react-router";
import { TermsOctober2026 } from "@/components/public/TermsOctober2026";
import { LegalPage } from "@/components/public/LegalPage";
import { pageHead } from "@/components/public/page-kit";
import { TERMS_PAYMENT_SECTIONS, TERMS_VERSION, POLICY_EFFECTIVE_DATE, REFUND_VERSION_URL } from "@/lib/payment-policy";
export const Route = createFileRoute("/terms")({
  validateSearch: (search: Record<string, unknown>): { version?: string } => ({ version: typeof search.version === 'string' ? search.version : undefined }),
  head: () => pageHead("/terms", "Terms and Conditions | MY FLORIDA NEMT", "Platform and provider responsibilities, recurring billing, Network fees, holds, disputes and versioned electronic purchase consent."),
  beforeLoad:({search})=>{throw redirect({to:'/policies',search:{version:search.version},hash:'terms',statusCode:301});},
});
function Terms() {
  const { version } = Route.useSearch();
  if(version==='2026-10-01')return <TermsOctober2026/>;
  const valid = version === undefined || version === TERMS_VERSION;
  return <LegalPage crumb="Terms and Conditions" title={valid ? "Terms and Conditions" : "Terms version unavailable"} intro={valid ? <>Version {TERMS_VERSION}. These terms incorporate the <a className="underline" href={REFUND_VERSION_URL}>Refund &amp; Payment Reversal Policy</a>. Retain both with your purchase review.</> : 'This version is unavailable. Another version is not substituted.'} dateLabel="Effective" date={POLICY_EFFECTIVE_DATE} sections={valid ? TERMS_PAYMENT_SECTIONS.map(s => ({ id: s.id, h: s.h, body: <>{s.paragraphs.map(p => <p key={p}>{p}</p>)}</> })) : []}/>;
}
