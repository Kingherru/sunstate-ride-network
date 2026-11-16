import { useState } from 'react';
import { SettingsShell } from './SettingsShell';
import { PersonalSettings } from './PersonalSettings';
import { PersonalSecurity } from './PersonalSecurity';
import { PatientRelationship } from './PatientRelationship';
import { SignInPreference } from './SignInPreference';
import { InterfaceSize } from './InterfaceSize';
import { SecureEmailChange } from './SecureEmailChange';
import { BusinessContactSettings } from '@/components/onboarding/BusinessContactSettings';
import { CustomerBilling } from './CustomerBilling';
import { BusinessPermissions } from './BusinessPermissions';
import { usePortalPreview } from './preview-data';

/** The same customer settings surface is used in live accounts and protected previews. */
export function CustomerSettings({ patient, workspaceId, canManage = false, email }: { patient: boolean; workspaceId?: string; canManage?: boolean; email?: string | null }) {
  const [tab, setTab] = useState('profile');
  const preview = usePortalPreview();
  return <SettingsShell value={tab} onChange={setTab} aliases={{ interface: 'signin', account: 'security' }} sections={[
    { value: 'profile', label: patient ? 'Owner & Patient Profile' : 'Profile & Organization' },
    ...(!patient && workspaceId && canManage ? [{ value: 'staff', label: 'Staff & Access' }] : []),
    { value: 'notifications', label: 'Notifications' },
    { value: 'accessibility', label: 'Accessibility' },
    { value: 'signin', label: 'Sign-in Preferences' },
    { value: 'security', label: 'Account & Security' },
  ]}>
    {tab === 'profile' && <div className="space-y-6">
      <PersonalSettings section="profile" />
      {patient && canManage && <PatientRelationship />}
      {!patient && workspaceId && canManage && <BusinessContactSettings workspaceId={workspaceId} />}
    </div>}
    {tab === 'notifications' && <PersonalSettings section="notifications" requiredInApp />}
    {tab === 'accessibility' && <InterfaceSize />}
    {tab === 'signin' && <SignInPreference />}
    {tab === 'staff' && !patient && workspaceId && canManage && <BusinessPermissions workspaceId={workspaceId} />}
    {tab === 'security' && <div className="space-y-6">
      <SecureEmailChange />
      <PersonalSecurity email={email} securityOnly inline />
      {!preview.active && workspaceId && <details><summary className="ds-label cursor-pointer">Advanced: billing records & preferences</summary><div className="pt-4"><CustomerBilling /></div></details>}
    </div>}
  </SettingsShell>;
}