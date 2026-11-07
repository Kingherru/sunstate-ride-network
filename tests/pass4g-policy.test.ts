import {describe,it,expect} from 'bun:test';
import {assertCheckoutConsent,currentCheckoutConsent,TERMS_VERSION,PAYMENT_POLICY_VERSION} from '../src/lib/payment-policy';
import {allocateReversalResponsibility,type ReversalEvidence} from '../src/lib/refund-responsibility';
import {canOpen} from '../src/lib/admin-permissions';
const evidence:ReversalEvidence={chargeType:'separate_charge_transfer',cause:'provider_failure',originalChargeRef:'ch_synthetic',originalPaymentRef:'pay_synthetic',originalTransferRef:'tr_synthetic',applicationFeeRef:'fee_synthetic',principalCents:12000,remainingPrincipalCents:12000,transferReverseCents:10000,remainingTransferCents:10000,processorFeeNotReturnedCents:400,applicationFeeCents:200,applicationFeeTreatment:'review_required',providerAccount:'provider',senderAccount:'sender',receiverAccount:'receiver',acceptedCancellationChargeCents:1500,payoutAlreadyReleased:false,policyVersion:PAYMENT_POLICY_VERSION,acceptanceId:'MFN-AC-SYNTHETIC',authoritativeCauseRef:'verified-case'};
describe('checkout policy versions',()=>{
 it('rejects unchecked acknowledgment',()=>expect(()=>assertCheckoutConsent(currentCheckoutConsent(false))).toThrow());
 it('requires the exact terms release',()=>expect(()=>assertCheckoutConsent({...currentCheckoutConsent(true),termsVersion:'2026-10-01'})).toThrow());
 it('requires exact refund release',()=>expect(()=>assertCheckoutConsent({...currentCheckoutConsent(true),refundVersion:'future'})).toThrow());
 it('accepts current versions only',()=>{expect(()=>assertCheckoutConsent(currentCheckoutConsent(true))).not.toThrow();expect(TERMS_VERSION).toBe('2026-11-07');});
});
describe('approved responsibility, never money movement',()=>{
 it('provider failure assigns full principal and unrecovered costs to provider',()=>{const r=allocateReversalResponsibility(evidence);expect(r.principalCents).toBe(12000);expect(r.responsibleAccount).toBe('provider');expect(r.processorFeeNotReturnedCents).toBe(400);expect(r.platformAbsorptionCents).toBe(0);});
 it('provider failure cannot prepare a partial principal return',()=>expect(()=>allocateReversalResponsibility({...evidence,principalCents:6000})).toThrow());
 it('confirmed duplicate cannot retain part of principal',()=>expect(()=>allocateReversalResponsibility({...evidence,cause:'duplicate',principalCents:6000})).toThrow());
 it('customer cancellation applies only accepted charge with provider costs',()=>{const r=allocateReversalResponsibility({...evidence,cause:'customer_cancellation'});expect(r.customerCancellationChargeCents).toBe(1500);expect(r.responsibleAccount).toBe('provider');expect(r.undisclosedCustomerRefundFeeCents).toBe(0);});
 it('receiver failure before payout blocks payout against held funds',()=>{const r=allocateReversalResponsibility({...evidence,cause:'receiver_failure'});expect(r.recoveryStatus).toBe('held_funds_block_payout');expect(r.responsibleAccount).toBe('receiver');});
 it('receiver failure after payout opens recovery, never autocharges',()=>{const r=allocateReversalResponsibility({...evidence,cause:'receiver_failure',payoutAlreadyReleased:true});expect(r.recoveryStatus).toBe('negative_balance_recovery_review');expect(r.autoCharge).toBe(false);});
 it('sender cancellation belongs to sender',()=>expect(allocateReversalResponsibility({...evidence,cause:'sender_cancellation'}).responsibleAccount).toBe('sender'));
 it('platform error requires Master cause review without charging',()=>{const r=allocateReversalResponsibility({...evidence,cause:'platform_technical'});expect(r.recoveryStatus).toBe('master_cause_review');expect(r.autoCharge).toBe(false);expect(r.responsibleAccount).toBeNull();});
 it('duplicate principal requires cause review',()=>{const r=allocateReversalResponsibility({...evidence,cause:'duplicate'});expect(r.principalCents).toBe(12000);expect(r.recoveryStatus).toBe('master_cause_review');});
 it('never reverses beyond remaining principal',()=>expect(()=>allocateReversalResponsibility({...evidence,principalCents:12001})).toThrow());
 it('never reverses beyond remaining transfer',()=>expect(()=>allocateReversalResponsibility({...evidence,transferReverseCents:10001})).toThrow());
 it('direct charge cannot imply platform transfer reversal',()=>expect(()=>allocateReversalResponsibility({...evidence,chargeType:'direct'})).toThrow());
 it('application fee treatment stays explicit and actions off',()=>{const r=allocateReversalResponsibility({...evidence,chargeType:'destination'});expect(r.applicationFeeTreatment).toBe('review_required');expect(r.actionEnabled).toBe(false);});
 it('regular finance admin cannot open refund review',()=>expect(canOpen('/admin/refund-review',{master:false,sections:{payouts:'manage'},scope:'all'})).toBe(false));
 it('Master can open read-only review',()=>expect(canOpen('/admin/refund-review',{master:true,sections:{},scope:'all'})).toBe(true));
});