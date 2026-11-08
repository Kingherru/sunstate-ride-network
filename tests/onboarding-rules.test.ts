import { describe, expect, it } from 'vitest';
import { onboardingInput, shouldResumeOnboarding } from '../src/lib/onboarding-rules';
describe('Resumable non-destructive onboarding', () => {
  it('requires an explicit self/other choice and other-patient relationship',()=>{const p={section:'patient',first_name:'Demo',last_name:'Patient',mobility:'wheelchair'};expect(onboardingInput.safeParse({...p,accountFor:''}).success).toBe(false);expect(onboardingInput.safeParse({...p,accountFor:'another',relationship:''}).success).toBe(false);expect(onboardingInput.safeParse({...p,accountFor:'another',relationship:'Parent'}).success).toBe(true);});
  it('does not force established accounts with no setup marker', () => { expect(shouldResumeOnboarding(null, null)).toBe(false); });
  it('resumes saved setup after sign-in', () => { expect(shouldResumeOnboarding(2, null)).toBe(true); });
  it('does not force completed accounts through setup', () => { expect(shouldResumeOnboarding(4, '2026-11-07T19:22:00Z')).toBe(false); });
  it('rejects browser assigned roles and MFN IDs', () => { expect(onboardingInput.safeParse({ section: 'personal', firstName: 'Pat', lastName: 'Example', phone: '5555555555', role: 'admin', mfn_id: 'MFN-P-1' }).success).toBe(false); });
  it('rejects diagnoses and medical notes during onboarding', () => { expect(onboardingInput.safeParse({ section: 'patient', accountFor: 'another', first_name: 'Pat', last_name: 'Example', mobility: 'wheelchair', diagnosis_code: 'private' }).success).toBe(false); });
});