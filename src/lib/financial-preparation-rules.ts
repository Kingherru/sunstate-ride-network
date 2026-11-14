/** Preparation only. No browser redirect, elapsed timer or badge can prove payment. */
export const FINANCIAL_VERSION = '2026-11-08.4m' as const;
export const PAYMENT_PURPOSES = ['platform_purchase', 'provider_customer_invoice', 'network_referral_funding'] as const;
export type PaymentPurpose = typeof PAYMENT_PURPOSES[number];
export type FinancialEnvironment = 'sandbox' | 'live';
export const FINANCIAL_GATES = ['checkout', 'collection', 'connect', 'funding', 'transfers', 'payouts', 'entitlements', 'delivery', 'scheduler', 'refundExecution'] as const;
export function financialActivationAllowed(flags: Partial<Record<typeof FINANCIAL_GATES[number], boolean>>, prerequisites: boolean) {
  return prerequisites && FINANCIAL_GATES.every(key => flags[key] === true);
}
export type CatalogLine = {
  productId: string; kind: 'base' | 'network_addon' | 'contractor' | 'course' | 'test' | 'digital_guide'; title: string;
  priceKey: string; stripeProductId: string | null; stripePriceId: string | null;
  unitCents: number; currency: string; recurrence: 'month' | null; quantity: number;
  catalogVersion: string; environment: FinancialEnvironment; termsVersion: string; refundVersion: string;
};
export function reconstructCart(ids: readonly string[], catalog: readonly CatalogLine[], environment: FinancialEnvironment, context: { provider: boolean; contractor?: boolean; baseReserved: boolean; addonReserved: boolean; owned: readonly string[]; trialUsed: boolean }) {
  if (environment !== 'sandbox') throw new Error('Sandbox preparation only');
  if (!ids.length || ids.length > 22 || new Set(ids).size !== ids.length) throw new Error('Invalid cart selection');
  const lines = ids.map(id => {
    const item = catalog.find(c => c.productId === id && c.environment === environment);
    if (!item || !Number.isSafeInteger(item.unitCents) || item.unitCents < 0 || item.currency !== 'usd' || item.quantity !== 1 || context.owned.includes(id)) throw new Error('Item unavailable');
    if ((item.kind === 'base' || item.kind === 'network_addon') && !context.provider) throw new Error('Provider business required');
    if(item.kind==='contractor'&&(!context.contractor||item.unitCents!==2000||item.recurrence!=='month'))throw new Error('Contractor membership requires a contractor account and authoritative $20 monthly price');
    return { ...item };
  });
  const base = lines.some(c => c.kind === 'base'), addon = lines.some(c => c.kind === 'network_addon');
  const contractor=lines.some(c=>c.kind==='contractor');
  if(contractor&&(base||addon))throw new Error('Contractor membership is separate from business membership');
  if(contractor&&context.baseReserved)throw new Error('Existing contractor subscription requires management');
  if (base && context.baseReserved) throw new Error('Existing base subscription requires management');
  if (addon && context.addonReserved) throw new Error('Existing Network add-on');
  if (addon && !base) throw new Error('Later add-on requires authoritative subscription and proration review');
  const trialDays = base && !context.trialUsed ? 30 : 0;
  const recurringCents = lines.filter(c => c.recurrence).reduce((n,c) => n+c.unitCents*c.quantity,0);
  const oneTimeCents = lines.filter(c => !c.recurrence).reduce((n,c) => n+c.unitCents*c.quantity,0);
  // Stripe trial + one-time billing timing must be confirmed before a due-now promise is made.
  return { lines, trialDays, recurringCents, oneTimeCents, dueNowCents: trialDays && oneTimeCents ? null : oneTimeCents+(trialDays ? 0 : recurringCents), firstRenewalAt: null, mode: base || contractor ? 'subscription' as const : 'payment' as const };
}
export function paidEntitlements(s: { status: string; paidState: string | null; paidThrough: string | null; addonStatus: string; addonPaid: boolean; frozen: boolean }, now: number) {
  const current = s.paidThrough !== null && Date.parse(s.paidThrough) > now;
  const base = !s.frozen && s.paidState === 'succeeded' && current && ['active','canceled'].includes(s.status);
  return { base, network: base && s.addonPaid && ['active','canceling','canceled'].includes(s.addonStatus), trial: !s.frozen && s.status === 'trialing', semiVerifiedPayment: base };
}
export function priceProtectionThrough(enrolledAt: string, through: string) {
  const start = new Date(enrolledAt), end = new Date(through), max = new Date(start);
  max.setUTCFullYear(max.getUTCFullYear()+1);
  return Number.isFinite(start.getTime()) && end > start && end <= max;
}
export type Obligation = { purpose: PaymentPurpose; environment: FinancialEnvironment; objectId: string; objectType: string; account: string | null; workspaceId: string; referenceId: string; amountCents: number; currency: string; acceptanceId: string };
export type PaymentEvidence = Obligation & { livemode: boolean; eventId: string; eventCreated: number };
export function evidenceMismatch(expected: Obligation, actual: PaymentEvidence): string | null {
  if (actual.livemode !== (expected.environment === 'live')) return 'environment_mismatch';
  for (const key of ['purpose','environment','objectId','objectType','account','workspaceId','referenceId','amountCents','currency','acceptanceId'] as const) {
    if (expected[key] !== actual[key]) return `${key}_mismatch`;
  }
  return !Number.isSafeInteger(actual.amountCents) || actual.amountCents < 0 ? 'invalid_amount' : null;
}
export function convergeEvidence(previous: { state: string; created: number }, incoming: { state: string; created: number }) {
  const frozen = new Set(['refunded','disputed','reversed','negative_balance','pending_policy_review']);
  if (frozen.has(incoming.state)) return { state:'pending_policy_review',created:Math.max(previous.created,incoming.created) };
  if (frozen.has(previous.state) || incoming.created < previous.created || (previous.state === 'paid' && ['pending','failed','canceled'].includes(incoming.state))) return previous;
  return incoming;
}
export function connectChecklist(account: { charges: boolean; payouts: boolean; details: boolean; dueCount: number; restricted: boolean } | null) {
  return { state: !account ? 'Not started' : account.restricted ? 'Restricted' : !account.details || account.dueCount > 0 ? 'Information required' : !account.charges && !account.payouts ? 'Under review' : 'Reviewed', customerReady: !!account?.charges && !account.restricted && account.dueCount === 0, networkReady: !!account?.payouts && !account.restricted && account.dueCount === 0 };
}
export type LedgerEntry = { account: string; debitCents: number; creditCents: number; currency: string };
export function referralAccounting(receiverCents: number, processingCents: number | null, taxCents: number | null, feeTreatmentApproved: boolean) {
  if (!Number.isSafeInteger(receiverCents) || receiverCents <= 0 || !feeTreatmentApproved || processingCents === null || taxCents === null || ![processingCents,taxCents].every(v=>Number.isSafeInteger(v)&&v>=0)) throw new Error('NOT CONFIGURED');
  const networkCents = Math.round(receiverCents*200/10000), totalCents = receiverCents+networkCents+processingCents+taxCents;
  if (!Number.isSafeInteger(totalCents)) throw new Error('Invalid amount');
  const entries: LedgerEntry[] = [{account:'sender_obligation',debitCents:totalCents,creditCents:0,currency:'usd'},...[
    ['receiver_payable',receiverCents],['network_revenue',networkCents],['processing_recovery',processingCents],['tax_payable',taxCents],
  ].map(([account,cents])=>({account:String(account),debitCents:0,creditCents:Number(cents),currency:'usd'}))];
  return { receiverCents,networkCents,processingCents,taxCents,totalCents,entries };
}
export function ledgerBalanced(entries: readonly LedgerEntry[]) {
  return entries.length > 1 && new Set(entries.map(e=>e.currency)).size === 1 && entries.every(e=>[e.debitCents,e.creditCents].every(v=>Number.isSafeInteger(v)&&v>=0)) && entries.reduce((n,e)=>n+e.debitCents-e.creditCents,0) === 0;
}
export function lockedHold(tier: string, completedAt: string | null, settledAt: string | null, frozen: boolean, now: number) {
  const holdDays = ['gold','super_verified'].includes(tier) ? 4 : 10;
  if (!completedAt || !settledAt || !Number.isFinite(Date.parse(completedAt)) || !Number.isFinite(Date.parse(settledAt))) return {holdDays,availableAt:null,eligible:false};
  const start = Math.max(Date.parse(completedAt),Date.parse(settledAt));
  const at = Math.max(start+holdDays*86400000,Date.parse(completedAt)+24*3600000);
  return {holdDays,availableAt:new Date(at).toISOString(),eligible:!frozen && now>=at};
}