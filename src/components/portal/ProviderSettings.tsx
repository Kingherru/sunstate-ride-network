import { useState } from 'react';
import { SegTabs } from './SegTabs';
import { PersonalSecurity } from './PersonalSecurity';
import { PersonalSettings } from './PersonalSettings';
import { BusinessInfoPanel } from '@/components/dashboard/BusinessInfoPanel';
import { NetworkProfileForm } from '@/components/network/NetworkProfileForm';
import { ProviderCredentialsPanel } from '@/components/dashboard/ProviderCredentialsPanel';
import { IntegrationsPanel } from '@/components/dashboard/IntegrationsPanel';
import { ProviderPlatformRequests } from '@/components/messaging/PlatformRequests';
import { ProviderExports } from './ProviderExports';
import { usePortalPreview } from './preview-data';
import { PROVIDER_VERIFICATION_POLICY } from '@/lib/account-settings-rules';
import { ProviderVerificationBadge } from './ProviderVerificationBadge';

const sections = [
  { value: 'business', label: 'Business Information' }, { value: 'contact', label: 'Contact Information' },
  { value: 'services', label: 'Services & Operating Hours' }, { value: 'areas', label: 'Service Areas' },
  { value: 'documents', label: 'Insurance & Documents' }, { value: 'verification', label: 'Business Verification' },
  { value: 'notifications', label: 'Notifications' }, { value: 'requests', label: 'Platform Requests' },
  { value: 'integrations', label: 'API & Dispatch Integration' }, { value: 'account', label: 'Account Settings' },
  { value: 'security', label: 'Security' },
];
/** Legacy person-owned documents/integrations remain owner-only, not implicitly shared. */
export function ProviderSettings({ workspaceId, role, email }: { workspaceId: string; role: string; email?: string | null }) {
  const [tab, setTab] = useState('business'); const preview = usePortalPreview(); const owner = role === 'owner';
  return <div className="space-y-5"><SegTabs label="Provider settings sections" options={sections} value={tab} onChange={setTab} />
    {tab === 'business' && <BusinessInfoPanel />}
    {(tab === 'contact' || tab === 'services' || tab === 'areas') && <NetworkProfileForm key={tab} workspaceId={workspaceId} section={tab} />}
    {tab === 'documents' && (preview.active ? <p className="ds-support">No demo documents.</p> : owner ? <ProviderCredentialsPanel /> : <p className="ds-support">Legacy documents are available to their owner only.</p>)}
    {tab === 'verification' && <section className="space-y-5">
      <h2 className="ds-subheading uppercase text-ds-primary">Business verification</h2>
      <ProviderVerificationBadge workspaceId={workspaceId} />
      <p className="ds-support">Membership verification requires an explicitly linked business membership and a confirmed paid Stripe invoice. Full business/document verification and Gold remain unavailable until their required evidence is connected.</p>
      <div className="space-y-2">
        <h3 className="ds-label text-ds-primary">Semi-Verified — Light Blue</h3>
        <p className="ds-body">Requires the first successful ${PROVIDER_VERIFICATION_POLICY.membershipCents / 100} monthly Provider Membership payment after the {PROVIDER_VERIFICATION_POLICY.trialDays}-day free trial, with membership current and in good standing.</p>
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
    </section>}
    {tab === 'notifications' && <PersonalSettings />}
    {tab === 'requests' && <ProviderPlatformRequests workspaceId={workspaceId} />}
    {tab === 'integrations' && <div className="space-y-6">{owner ? <IntegrationsPanel /> : <p className="ds-support">Legacy API connections remain owner-only.</p>}<ProviderExports /></div>}
    {(tab === 'account' || tab === 'security') && <PersonalSecurity email={email} />}
  </div>;
}