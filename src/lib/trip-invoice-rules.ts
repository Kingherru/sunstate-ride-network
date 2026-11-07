import { z } from 'zod';
import { customerQuoteInput } from './provider-customer-pricing';

const cents = z.number().int().nonnegative().max(2147483647);
export const invoiceAdjustment = z.object({ kind: z.enum(['adjustment', 'discount']), cents, reason: z.string().trim().min(3).max(300) }).strict();
export const prepareTripQuoteInput = z.object({
  workspaceId: z.string().uuid(), draftId: z.string().uuid(),
  trip: customerQuoteInput.refine(t => t.outcome === 'normal', 'Cancellation and no-show terms are not new-trip charges.'),
  mileageConfirmed: z.literal(true), expectedQuoteId: z.string().uuid().nullable(),
  replacementConfirmed: z.boolean(), adjustments: z.array(invoiceAdjustment).max(20).default([]),
  terms: z.string().trim().max(3000).default(''),
}).strict();
export type InvoiceLine = { label: string; cents: number; quantity?: number; rateCents?: number; kind?: string; reason?: string };
export type TripInvoice = { id: string; mfnId: string; requestId: string; requestNumber: string; providerName: string; billTo: string; providerPhone: string | null; lines: InvoiceLine[]; totalCents: number; paidCents: number; balanceCents: number; status: string; quoteVersion: number; terms: string; dueAt: string | null; createdAt: string; canManage: boolean; canPay: boolean; paymentConfigured: boolean; events?: {action:string;created_at:string}[]; history: { reference: string; status: string; amountCents: number; refundedCents: number; createdAt: string }[] };

export function appendInvoiceAdjustments(calculated: InvoiceLine[], adjustments: z.infer<typeof invoiceAdjustment>[]) {
  const original = calculated.map(l => ({ ...l }));
  const extra = adjustments.map(a => { const v = invoiceAdjustment.parse(a); return { label: v.kind === 'discount' ? 'Discount' : 'Provider adjustment', cents: v.kind === 'discount' ? -v.cents : v.cents, kind: v.kind, reason: v.reason }; });
  const totalCents = [...original, ...extra].reduce((sum, l) => sum + l.cents, 0);
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > 2147483647) throw new Error('Adjustments must leave a valid nonnegative total.');
  return { lines: [...original, ...extra], totalCents };
}
export function invoiceCanStartPayment(invoice: { status: string; balanceCents: number; paymentConfigured: boolean }) {
  return invoice.paymentConfigured && ['ready', 'sent', 'payment_pending', 'failed'].includes(invoice.status) && Number.isSafeInteger(invoice.balanceCents) && invoice.balanceCents > 0;
}
export function patientContactProjection(input: { confirmed: boolean; dispatchDesignated: boolean; dispatchPhone: string | null; driverAssigned: boolean; driverName: string | null; assignedDriverId: string | null; consentDriverId: string | null; providerConfirmed: boolean; driverConfirmed: boolean; driverPhone: string | null }) {
  return { dispatchPhone: input.confirmed && input.dispatchDesignated ? input.dispatchPhone : null, driverName: input.driverAssigned ? input.driverName : null, driverPhone: input.driverAssigned && input.assignedDriverId === input.consentDriverId && input.providerConfirmed && input.driverConfirmed ? input.driverPhone : null };
}