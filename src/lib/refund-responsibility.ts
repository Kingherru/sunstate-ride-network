import { z } from 'zod';
export const reversalEvidenceInput = z.object({
  chargeType: z.enum(['direct', 'destination', 'separate_charge_transfer']),
  cause: z.enum(['provider_failure', 'customer_cancellation', 'receiver_failure', 'sender_cancellation', 'platform_technical', 'duplicate']),
  originalChargeRef: z.string().min(1), originalPaymentRef: z.string().min(1), originalTransferRef: z.string().nullable(), applicationFeeRef: z.string().nullable(),
  principalCents: z.number().int().nonnegative(), remainingPrincipalCents: z.number().int().nonnegative(),
  transferReverseCents: z.number().int().nonnegative(), remainingTransferCents: z.number().int().nonnegative(),
  processorFeeNotReturnedCents: z.number().int().nonnegative(), applicationFeeCents: z.number().int().nonnegative(),
  applicationFeeTreatment: z.enum(['retained', 'refunded', 'recovered', 'review_required']),
  providerAccount: z.string().nullable(), senderAccount: z.string().nullable(), receiverAccount: z.string().nullable(),
  acceptedCancellationChargeCents: z.number().int().nonnegative(), payoutAlreadyReleased: z.boolean(),
  policyVersion: z.string().min(1), acceptanceId: z.string().min(1), authoritativeCauseRef: z.string().min(1),
}).strict();
export type ReversalEvidence = z.infer<typeof reversalEvidenceInput>;
/** Pure preparation, never a money movement or eligibility engine for subscriptions/training. */
export function allocateReversalResponsibility(value: ReversalEvidence) {
  const v = reversalEvidenceInput.parse(value);
  if (v.principalCents > v.remainingPrincipalCents || v.transferReverseCents > v.remainingTransferCents) throw new Error('Exceeds authoritative remaining amount.');
  if (v.cause === 'provider_failure' && v.principalCents !== v.remainingPrincipalCents) throw new Error('Provider failure requires full remaining customer principal return.');
  if (v.cause === 'duplicate' && v.principalCents !== v.remainingPrincipalCents) throw new Error('Confirmed duplicate principal must be returned in full.');
  if (v.transferReverseCents > 0 && (!v.originalTransferRef || v.chargeType === 'direct')) throw new Error('A direct charge cannot imply a platform transfer reversal.');
  const responsibleAccount = v.cause === 'provider_failure' || v.cause === 'customer_cancellation' ? v.providerAccount : v.cause === 'receiver_failure' ? v.receiverAccount : v.cause === 'sender_cancellation' ? v.senderAccount : null;
  if (responsibleAccount === null && !['platform_technical','duplicate'].includes(v.cause)) throw new Error('Responsible business evidence required.');
  return {
    ...v, responsibleAccount,
    recoveryStatus: ['platform_technical','duplicate'].includes(v.cause) ? 'master_cause_review' : v.cause === 'receiver_failure' ? v.payoutAlreadyReleased ? 'negative_balance_recovery_review' : 'held_funds_block_payout' : 'responsible_business_ledger',
    customerCancellationChargeCents: v.cause === 'customer_cancellation' ? v.acceptedCancellationChargeCents : 0,
    platformAbsorptionCents: 0, undisclosedCustomerRefundFeeCents: 0, autoCharge: false as const,
    idempotencyKey: `review:${v.originalPaymentRef}:${v.acceptanceId}:${v.authoritativeCauseRef}`,
    actionEnabled: false as const,
  };
}