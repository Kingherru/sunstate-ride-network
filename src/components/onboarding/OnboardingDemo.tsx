import { AccountOnboarding } from './AccountOnboarding';
import type { getOnboarding } from '@/lib/onboarding.functions';

export function OnboardingDemo({ provider, personal }: { provider: boolean; personal: boolean }) {
  const data: Awaited<ReturnType<typeof getOnboarding>> = {
    person: { first_name: 'Demo', last_name: 'Owner', display_name: 'Demo Owner', phone: '5555555555', mfn_id: 'MFN-P-DEMO', status: 'active', is_test_account: false, deleted_at: null, notification_preferences: { in_app: true, email: false }, onboarding_step: 0, onboarding_completed_at: null, onboarding_policy_version:null,onboarding_policy_accepted_at:null },
    workspace: { id: 'preview-ws', account_type: provider ? 'provider' : personal ? 'private_pay' : 'facility', display_name: provider ? 'Demo Transportation' : personal ? 'Demo Personal Account' : 'Demo Facility', mfn_id: 'MFN-A-DEMO', status: 'active', is_test_account: false, organization_type: provider ? 'transportation_provider' : personal ? 'private_pay_patient' : 'general_facility', legal_business_name: null, business_phone: null, dispatch_phone: null, business_address: null, mailing_address:null, operating_hours: null },
    legacy: null, patient: null, email: 'demo@example.com',
  };
  return <AccountOnboarding data={data} />;
}