import { z } from 'zod';

export const verificationDetailsInput = z.object({
  workspaceId: z.string().uuid(),
  legal_name: z.string().trim().min(2).max(200),
  dba: z.string().trim().max(200),
  business_type: z.enum(['corporation', 'llc', 'partnership', 'sole_proprietor', 'independent_contractor']),
  representative: z.string().trim().min(2).max(200),
  business_address: z.string().trim().min(6).max(300),
  service_location: z.string().trim().min(2).max(300),
  registration_number: z.string().trim().max(100),
  after_hours: z.boolean(),
  minimum_notice_hours: z.number().int().min(0).max(720),
  accepted_payers: z.array(z.enum(['private_pay', 'facility', 'broker', 'medicaid', 'workers_comp'])).min(1).max(5),
  local_permit_required: z.boolean(),
  professional_liability_required: z.boolean(),
  cargo_required: z.boolean(),
  program_credentials_required: z.boolean(),
  attested: z.literal(true),
  network_rules_acknowledged: z.literal(true),
}).strict();

export const credentialEvidenceInput = z.object({
  id: z.string().uuid().optional(), kind: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(160),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  effective_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  business_name: z.string().trim().max(200).optional(),
  accuracy_attested: z.boolean().optional(),
  doc_path: z.string().max(500).nullable().optional(), required: z.boolean().optional(), notes: z.string().max(2000).nullable().optional(),
}).strict();

export function normalizedBusinessName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(llc|inc|incorporated|corporation|corp|ltd)\b/g, '').replace(/\s+/g, ' ').trim();
}

export function documentEvidenceStatus(e: { applicable: boolean; exceptionAllowed: boolean; fileExists: boolean; privateBucket: boolean; businessName: string; legalName: string; dba?: string; attested: boolean; effectiveDateRequired: boolean; expirationRequired: boolean; effectiveAt: number | null; expiresAt: number | null }, now: number) {
  if (!e.applicable && e.exceptionAllowed) return 'Not Applicable';
  if (!Number.isFinite(now) || !e.fileExists || !e.privateBucket || !e.attested || !normalizedBusinessName(e.businessName) ||
    ![e.legalName, e.dba ?? ''].some(n => normalizedBusinessName(n) === normalizedBusinessName(e.businessName)) ||
    (e.effectiveDateRequired && e.effectiveAt === null) || (e.effectiveAt !== null && (!Number.isFinite(e.effectiveAt) || e.effectiveAt > now)) ||
    (e.expirationRequired && e.expiresAt === null)) return 'Missing';
  if (e.expiresAt !== null && (!Number.isFinite(e.expiresAt) || e.expiresAt <= now)) return 'Expired';
  if (e.expiresAt !== null && e.expiresAt <= now + 30 * 86400000) return 'Expiring Soon';
  return 'Complete';
}

/** Only an explicit, server-linked Network obligation can be settled by Stripe. */
export function qualifiesNetworkSettlement(e: { environment: string; linkedIntent: string; intentId: string; status: string; currency: string; received: number; expected: number; recipientAccount: string | null; destination: string | null; refunded: boolean; disputed: boolean; }) {
  return e.environment === 'live' && e.linkedIntent === e.intentId && e.status === 'succeeded' && e.currency === 'usd' &&
    Number.isInteger(e.expected) && e.expected > 0 && e.received === e.expected && !!e.recipientAccount &&
    e.destination === e.recipientAccount && !e.refunded && !e.disputed;
}