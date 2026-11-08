import { z } from 'zod';

export const onboardingInput = z.discriminatedUnion('section', [
  z.object({ section: z.literal('personal'), firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), phone: z.string().trim().regex(/^[0-9+().\-\s]{7,32}$/) }).strict(),
  z.object({ section: z.literal('business'), display_name: z.string().trim().min(1).max(160), legal_business_name: z.string().trim().max(160), business_phone: z.string().trim().max(32), dispatch_phone: z.string().trim().max(32), business_address: z.string().trim().max(300), mailing_address: z.string().trim().max(300).default(''), operating_hours: z.string().trim().max(500), npi: z.string().trim().regex(/^(\d{10})?$/), medicaid_number: z.string().trim().max(60) }).strict(),
  z.object({ section: z.literal('patient'), accountFor: z.enum(['myself', 'another']), first_name: z.string().trim().min(1).max(80), last_name: z.string().trim().min(1).max(80), relationship: z.string().trim().max(80).default(''), mobility: z.enum(['ambulatory', 'wheelchair', 'stretcher']) }).strict().refine(v=>v.accountFor==='myself'||Boolean(v.relationship.trim()),{message:'Choose your relationship to the patient.',path:['relationship']}),
]);

/** An optional setup marker never changes an established account's access. */
export function shouldResumeOnboarding(step: number | null | undefined, completed: string | null | undefined) {
  return step != null && !completed;
}