import { useState } from 'react';
import { Building2, MapPin, ShieldCheck, Bell, LockKeyhole, Accessibility } from 'lucide-react';
import { BusinessVisibility } from './BusinessVisibility';
import { SegTabs } from './SegTabs';
import { DsButton } from '@/components/ds/controls';
import { CustomerPricing } from './CustomerPricing';
import { BusinessPermissions } from './BusinessPermissions';
import { RulesPanel } from '@/components/dashboard/RulesPanel';
import { PersonalSecurity } from './PersonalSecurity';
import { PersonalSettings } from './PersonalSettings';
import { BusinessInfoPanel } from '@/components/dashboard/BusinessInfoPanel';
import { NetworkProfileForm } from '@/components/network/NetworkProfileForm';
import { ProviderCredentialsPanel } from '@/components/dashboard/ProviderCredentialsPanel';
import { IntegrationsPanel } from '@/components/dashboard/IntegrationsPanel';
import { ProviderPlatformRequests } from '@/components/messaging/PlatformRequests';
import { ProviderExports } from './ProviderExports';
import { ApiCredentials } from './ApiCredentials';
import { usePortalPreview } from './preview-data';
import { PROVIDER_VERIFICATION_POLICY } from '@/lib/account-settings-rules';
import { ProviderVerificationBadge } from './ProviderVerificationBadge';
import { VerificationEvidence, BusinessEvidenceEditor } from './VerificationEvidence';
import { Link } from '@tanstack/react-router';
import { MembershipBilling } from './MembershipBilling';
import { BillingDefaults } from './CustomerBilling';
import { ProviderSetup } from './ProviderSetup';
import { SignInPreference } from './SignInPreference';
import { InterfaceSize } from './InterfaceSize';
import { BusinessContactSettings } from '@/components/onboarding/BusinessContactSettings';
import { AccountConnections } from './AccountConnections';
import { TripDispatchSettings } from './TripCommunicationSettings';
import { SecureEmailChange } from './SecureEmailChange';
import { ConnectPreparation } from './ConnectPreparation';

const sections = [
  { value: 'business', label: 'Profile & Business', icon: Building2 },
  { value: 'pricing', label: 'Services, Areas & Pricing', icon: MapPin },
  { value: 'credentials', label: 'Credentials & Verification', icon: ShieldCheck },
  { value: 'team', label: 'Notifications & Connections', icon: Bell },
  { value: 'accessibility', label: 'Accessibility', icon: Accessibility },
  { value: 'account', label: 'Account & Security', icon: LockKeyhole, Accessibility },
];
const legacySections: Record<string, string> = { connections: 'team', contact: 'business', services: 'pricing', areas: 'pricing', documents: 'credentials', verification: 'credentials', membership: 'account', billing:'account', payouts: 'account', notifications: 'team', requests: 'account', integrations: 'team', security: 'account', profile: 'business' };
/** Legacy person-owned documents/integrations remain owner-only, not implicitly shared. */
export function ProviderSettings({ workspaceId, role, email, initialSection = 'business', accountDetails, teamMessaging, financialTools }: { workspaceId: string; role: string; email?: string | null; initialSection?: string; accountDetails?: React.ReactNode; teamMessaging?: React.ReactNode; financialTools?: React.ReactNode }) {
  const [tab, setTab] = useState(legacySections[initialSection] ?? (sections.some(s => s.value === initialSection) ? initialSection : 'business')); const preview = usePortalPreview(); const owner = role === 'owner';
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
    <SegTabs label="Provider settings sections" variant="rail" queryKey="section" aliases={legacySections} value={tab} onChange={setTab} options={sections}/>
    <div className="portal-business-form min-w-0 space-y-5">
    <p className="ds-caption border-b border-ds-border pb-3">Setup details may be completed later; missing information does not prevent portal access.</p>
    {tab === 'business' && <><ProviderSetup workspaceId={workspaceId}/><PersonalSettings section="profile" /></>}
    {tab === 'team' && <><PersonalSettings section="notifications" /><ProviderSetup workspaceId={workspaceId} delay/><TripDispatchSettings workspaceId={workspaceId}/><AccountConnections workspaceId={workspaceId} provider showVisibility={false} /><ConnectPreparation workspaceId={workspaceId}/></>}
    {tab === 'business' && <div className="space-y-5"><BusinessContactSettings workspaceId={workspaceId} /><section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Legal identity & operations attestation</h2><div className="portal-business-body"><p className="ds-caption">Verification identity and service-base attestation remain separate from workspace contact details; existing values are retained.</p>{preview.active ? <p className="ds-support mt-3">Preview only. Business attestations cannot be saved.</p> : <BusinessEvidenceEditor workspaceId={workspaceId} />}</div></section><details className="portal-business-section"><summary className="portal-business-heading ds-label cursor-pointer">Legacy application & HIPAA acknowledgment</summary><div className="portal-business-body"><BusinessInfoPanel /></div></details></div>}
    {tab === 'pricing' && <div className="space-y-5"><section className="portal-business-section"><div className="portal-business-body"><NetworkProfileForm workspaceId={workspaceId} section="operations" /></div></section><BusinessVisibility workspaceId={workspaceId} /><CustomerPricing workspaceId={workspaceId} /><details className="portal-business-section"><summary className="portal-business-heading ds-label cursor-pointer">Existing provider operating rules</summary><div className="portal-business-body"><RulesPanel /></div></details></div>}
    {tab === 'credentials' && <div className="space-y-5">{preview.active ? <p className="ds-support">Preview only. Document uploads are unavailable.</p> : owner ? <ProviderCredentialsPanel /> : <p className="ds-support">Legacy documents are available to their owner only.</p>}
    <section className="portal-business-section"><div className="portal-business-body space-y-5">
      <h2 className="ds-subheading uppercase text-ds-primary">Business verification</h2>
      <ProviderVerificationBadge workspaceId={workspaceId} />
      <VerificationEvidence workspaceId={workspaceId} />
      <div className="space-y-2">
        <h3 className="ds-label text-ds-primary">Semi-Verified — Light Blue</h3>
        <p className="ds-body">Requires a successful qualifying Provider Base Membership payment, with membership current and in good standing. The {PROVIDER_VERIFICATION_POLICY.trialDays}-day free trial alone does not qualify.</p>
        <p className="ds-support">The free trial, trip platform fees, Stripe fees, pending or failed payments and refunds do not qualify.</p>
      </div>
      <div className="space-y-2">
        <h3 className="ds-label text-ds-primary">Verified — Blue</h3>
        <p className="ds-body">Requires current qualifying membership, complete business and service details, Stripe business and payout verification, and all applicable documents present and current.</p>
        <details><summary className="ds-support cursor-pointer font-semibold text-ds-primary">Required details and documents</summary>
          <ul className="ds-support mt-3 list-disc space-y-2 pl-5">
            <li>Legal business name, applicable DBA and registration number, business type, authorized representative, business address, service location or base, business phone and email, dispatch contacts and permanent MFN ID.</li>
            <li>At least one approved active service; coverage, operating days and hours, after-hours availability, minimum advance notice, applicable active vehicles and capacity, accepted payer or trip types, and acknowledgment of Network payment, completion and conduct rules.</li>
            <li>Commercial automobile insurance for transportation vehicles, general liability, and applicable workers’ compensation or exemption; carrier, policy type, effective and expiration dates, and Certificate of Insurance.</li>
            <li>Completed W-9, applicable Florida registration or DBA documentation, active vehicle registration, applicable transportation or local licenses, and workers’ compensation certificate or exemption.</li>
            <li>Professional liability and cargo coverage apply only when services or contracts require them. Medicaid, AHCA, broker, NPI and other program credentials apply only when participation is claimed.</li>
            <li>Document business names must reasonably match the account. Missing, expired, failed or removed requirements pause the blue badge.</li>
          </ul>
        </details>
        <p className="ds-support">The badge confirms completion of platform requirements, not document authenticity or government endorsement. Insurance documents, W-9, policy numbers, tax information and personal identification are not public.</p>
      </div>
      <div className="space-y-2">
        <h3 className="ds-label text-ds-primary">Super Verified — Gold</h3>
        <p className="ds-body">Requires Verified status and at least {PROVIDER_VERIFICATION_POLICY.goldTrips} completed trips sent through Network, with receiving providers paid in full and the five most recent qualifying payments initiated on time. No overdue Network payments, active disputes or suspensions are allowed.</p>
        <p className="ds-support">Initiate payment within {PROVIDER_VERIFICATION_POLICY.paymentBusinessDays} business days after the receiving provider marks Completed and supplies required completion information. Report a legitimate dispute within {PROVIDER_VERIFICATION_POLICY.disputeHours} hours; a submitted dispute pauses the deadline until reviewed. Stripe processing and payout-transfer time are separate.</p>
        <p className="ds-support">Canceled, declined, refunded, test and demo trips do not count. Gold pauses for overdue payments and returns when eligibility is restored. Automatic level changes will be permanently audited; no administrator approval is required.</p>
      </div>
    </div></section></div>}
    {tab === 'accessibility' && <InterfaceSize/>}
    {tab === 'account' && <div className="space-y-5"><MembershipBilling workspaceId={workspaceId} role={role} />{owner && <><BillingDefaults showPaymentMethod={false} />{financialTools ?? <p className="ds-support">Preview only. No payout actions are available.</p>}{!preview.active && <Link to="/portal/earnings" className="ds-label text-ds-link underline">Earnings, settlement & payment history</Link>}</>}{!owner && <p className="ds-support">Financial records and payout controls remain limited to the business owner.</p>}</div>}
    {tab === 'team' && <div className="space-y-6"><section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Team & contractors</h2><div className="portal-business-body"><BusinessPermissions workspaceId={workspaceId} />{teamMessaging ?? <p className="ds-support">Preview only. Team messaging permissions cannot be changed.</p>}</div></section><section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">API & exports</h2><div className="portal-business-body space-y-5"><ProviderExports /><ApiCredentials /></div></section><section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Dispatch software integrations</h2><div className="portal-business-body"><p className="ds-support mb-4">Saving credentials does not verify a live connection; no vendor is connected in this release.</p>{owner ? <IntegrationsPanel /> : <p className="ds-support">Integration setup is limited to the account owner.</p>}</div></section></div>}
    {tab === 'accessibility' && <InterfaceSize/>}
    {tab === 'account' && <div className="space-y-5">{accountDetails ?? <PersonalSettings section="status" />}<SignInPreference /><PersonalSecurity email={email} securityOnly /><section className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Platform Requests & help</h2><div className="portal-business-body"><ProviderPlatformRequests workspaceId={workspaceId} /></div></section></div>}
    </div>
  </div>;
}
