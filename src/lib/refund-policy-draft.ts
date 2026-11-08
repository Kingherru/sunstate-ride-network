import { TERMS_VERSION } from './payment-policy';
export const REFUND_DRAFT_VERSION = '2026-11-08-draft-1';
export const OWNER_DECISIONS = [
  'Customer invoice charge model: direct, destination, or separate charge/transfer',
  'Processing recovery and responsible payer', 'Tax handling',
  'Subscription cancellation and proration', 'Digital access refund cutoff',
  'Referral cancellation before/after acceptance, completion and transfer',
] as const;
const categories = [
  ['provider_base', '$20 Provider base membership', 'Cancellation stops future renewal; no automatic retroactive or prorated refund. Uncharged trial has no monetary refund.'],
  ['network_addon', 'Optional $10 Network add-on', 'Cancellation stops future renewal; no automatic retroactive or prorated refund.'],
  ['training_tests', 'Training / tests', 'Review delivery, access, start and completion evidence; cutoff undecided.'],
  ['planning_guide', '$50 planning guide', 'Review delivery and access evidence; cutoff undecided.'],
  ['customer_invoice', 'Provider customer invoice', 'Authoritative provider/merchant policy and approved charge model required; no invented cancellation terms.'],
  ['network_funding', 'Network referral funding', 'Review funding, receiver acceptance, completion, dispute and transfer state.'],
  ['duplicate_technical', 'Duplicate / technical error', 'Separate authoritative cause and principal review; platform error requires Master Admin.'],
  ['unauthorized', 'Fraud / unauthorized payment', 'Separate confirmed unauthorized-payment and legal review.'],
  ['dispute', 'Dispute / chargeback', 'Freeze relevant unpaid/held funds pending authoritative resolution.'],
  ['failed_canceled', 'Failed / canceled payment', 'Require authoritative charge evidence; an uncharged payment has no monetary refund.'],
  ['partial_refund', 'Partial refund', 'Review authoritative remaining principal and separately evidenced fee/tax amounts.'],
  ['transfer_reversal', 'Transfer reversal', 'Separate transfer and charge evidence; never assume reversal returned processing or application fees.'],
] as const;
export const REFUND_DRAFT = Object.freeze({ version: REFUND_DRAFT_VERSION, state: 'draft', termsVersion: TERMS_VERSION, effectiveFrom: null, effectiveThrough: null, execution: false,
  matrix: categories.map(([category, title, conditions]) => ({ category, title, state: 'draft', requestWindow: null, conditions, fullOrPartial: 'pending_owner_review', processingResponsibility: 'separate_authoritative_evidence_required', platformFees: 'not_assumed_returned', taxes: 'not_configured', entitlementEffect: 'pending_policy_review_preserve_history', holdTransferEffect: 'freeze_relevant_unpaid_or_held_funds', requiredEvidence: ['signed_environment_bound_payment', 'accepted_policy_version', 'remaining_principal', 'delivery_access_acceptance_completion', 'fee_tax_transfer_evidence'], decisionRole: 'Master Admin review; merchant policy where applicable', policyVersion: REFUND_DRAFT_VERSION, termsVersion: TERMS_VERSION, effectiveFrom: null, effectiveThrough: null })) });
export function draftCanExecute(value: { state: string; execution: boolean }) { return value.state === 'approved' && value.execution === true; }