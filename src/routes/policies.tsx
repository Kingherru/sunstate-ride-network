import { createFileRoute } from '@tanstack/react-router';
import { LegalPage } from '@/components/public/LegalPage';
import { pageHead } from '@/components/public/page-kit';
import { PRIVACY_SECTIONS } from '@/components/public/privacy-sections';
import { ACCESSIBILITY_SECTIONS } from '@/components/public/accessibility-sections';
import { TermsOctober2026 } from '@/components/public/TermsOctober2026';
import { TERMS_PAYMENT_SECTIONS, REFUND_SECTIONS, PAYMENT_POLICY_VERSION, POLICY_EFFECTIVE_DATE } from '@/lib/payment-policy';
const paragraphs = (sections: {h:string;paragraphs:string[]}[]) => sections.map(s => <div key={s.h} className="space-y-3 py-4"><h3 className="ds-subheading text-ds-primary">{s.h}</h3>{s.paragraphs.map(p=><p key={p}>{p}</p>)}</div>);
export const Route = createFileRoute('/policies')({
 validateSearch:(s:Record<string,unknown>):{version?:string}=>({version:typeof s.version==='string'?s.version:undefined}),
 head:()=>pageHead('/policies','Our Policies | MY FLORIDA NEMT','Terms, privacy, accessibility, billing, cancellation, refunds and purchase policies with retained policy versions.'),
 component:Policies,
});
function Policies(){
 const {version}=Route.useSearch();
 if(version==='2026-10-01')return <TermsOctober2026/>;
 const valid=!version||version===PAYMENT_POLICY_VERSION;
 return <LegalPage crumb="Our Policies" title="OUR POLICIES" intro={valid?`Version ${PAYMENT_POLICY_VERSION}. Review and retain the sections that apply to your purchase. Provider-specific terms must also be displayed before payment.`:'Requested policy version unavailable. No newer version is substituted.'} dateLabel="Effective" date={POLICY_EFFECTIVE_DATE} sections={valid?[
 {id:'terms',h:'Terms and Conditions',body:paragraphs(TERMS_PAYMENT_SECTIONS)},
 {id:'privacy',h:'Privacy',body:PRIVACY_SECTIONS.map(s=><div key={s.id} className="space-y-3 py-4"><h3 className="ds-subheading">{s.h}</h3>{s.body}</div>)},
 {id:'accessibility',h:'Accessibility',body:ACCESSIBILITY_SECTIONS.map(s=><div key={s.id} className="space-y-3 py-4"><h3 className="ds-subheading">{s.h}</h3>{s.body}</div>)},
 {id:'billing',h:'Payment and Billing',body:paragraphs(TERMS_PAYMENT_SECTIONS.filter(s=>['provider-prices','network-responsibility','reversals'].includes(s.id)))},
 {id:'cancellation',h:'Trip Cancellation and No-Show',body:paragraphs(REFUND_SECTIONS.filter(s=>s.id==='trip-invoices'))},
 {id:'refunds',h:'Refunds and Payment Reversals',body:paragraphs(REFUND_SECTIONS)},
 {id:'membership',h:'Membership and Referral Network Add-on',body:paragraphs(REFUND_SECTIONS.filter(s=>s.id==='subscriptions'))},
 {id:'digital-purchases',h:'Training, Tests, and Digital Guide Purchases',body:<>{paragraphs(REFUND_SECTIONS.filter(s=>s.id==='training'))}<p>The $50 one-time guide, How to Start an NEMT Business in 30 Days or Less, is simplified educational information, not a certification, legal, insurance, tax, licensing, Medicaid-enrollment or broker approval. The supplied final edition is licensed for the purchaser’s individual or internal business use; resale, public posting and redistribution are prohibited. Download requires a signed-in successful purchaser. Guide refund eligibility has not been approved; separately displayed purchase terms are required before checkout is enabled.</p></>},
 ]:[]}/>;
}