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
    {tab === 'verification' && <section className="space-y-3"><h2 className="ds-subheading uppercase text-ds-primary">Business verification</h2><p className="ds-support">Current directory verification remains platform-controlled. Payment and document checks must be connected to the workspace before automatic badge changes can be enabled.</p><p className="ds-support">Super Verification is unavailable: no approved numerical threshold for successful, paid provider-to-provider trips is configured.</p></section>}
    {tab === 'notifications' && <PersonalSettings />}
    {tab === 'requests' && <ProviderPlatformRequests workspaceId={workspaceId} />}
    {tab === 'integrations' && <div className="space-y-6">{owner ? <IntegrationsPanel /> : <p className="ds-support">Legacy API connections remain owner-only.</p>}<ProviderExports /></div>}
    {(tab === 'account' || tab === 'security') && <PersonalSecurity email={email} />}
  </div>;
}