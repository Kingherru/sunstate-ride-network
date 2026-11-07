import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { prepareTripQuoteInput, appendInvoiceAdjustments, type TripInvoice } from './trip-invoice-rules';
const idInput = z.object({ invoiceId: z.string().uuid() }).strict();

export const confirmTripCustomerQuote = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => prepareTripQuoteInput.parse(v))
  .handler(async ({ data, context }) => {
    const { quoteNewProviderCustomerTrip } = await import('./provider-customer-pricing.server');
    const { data: draft } = await context.supabase.from('trip_drafts').select('payload').eq('id', data.draftId).eq('user_id', context.userId).is('submitted_trip_id', null).maybeSingle();
    if (!draft) throw new Error('Draft not available.');
    const form = draft.payload as Record<string, unknown>;
    // Calculation parameters must agree with the saved form, not caller-supplied trip prices.
    const delivery = form.requestCategory === 'medical_delivery';
    const trip = { ...data.trip, service: delivery ? 'medical_delivery' as const : form.transportType === 'gurney' ? 'stretcher' as const : form.transportType as 'ambulatory' | 'wheelchair', pickupDate: String(form.pickupDate ?? form.requestedDate ?? ''), pickupTime: String(form.pickupTime ?? form.requestedTime ?? ''), roundTrip: form.tripType === 'round_trip', additionalStops: Array.isArray(form.additionalStops) ? form.additionalStops.length : 0, signature: delivery && form.signatureRequired === true, outcome: 'normal' as const };
    const calculated = await quoteNewProviderCustomerTrip(context.supabase, data.workspaceId, trip);
    const adjusted = appendInvoiceAdjustments(calculated.lines, data.adjustments);
    const { data: fingerprint, error: fpError } = await context.supabase.rpc('customer_quote_fingerprint', { _form: form as never });
    if (fpError || !fingerprint) throw new Error('Trip snapshot unavailable.');
    const { data: person } = await context.supabase.from('user_profiles').select('mfn_id').eq('user_id', context.userId).maybeSingle();
    const snapshot = { ...adjusted, id: crypto.randomUUID(), version: 1, rateVersionId: calculated.pricingSnapshot.rateVersionId, rateVersion: calculated.pricingSnapshot.version, trip, formFingerprint: fingerprint, mileageSource: 'manual_confirmed', quotedAt: calculated.quotedAt, personMfnId: person?.mfn_id ?? null, workspaceId: data.workspaceId, terms: data.terms };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: history } = await context.supabase.from('trip_drafts').select('customer_quote_history').eq('id', data.draftId).eq('user_id', context.userId).maybeSingle();
    snapshot.version = Array.isArray(history?.customer_quote_history) ? history.customer_quote_history.length + 1 : 1;
    const { error } = await supabaseAdmin.rpc('persist_provider_draft_quote', { _draft: data.draftId, _workspace: data.workspaceId, _actor: context.userId, _snapshot: snapshot as never, ...({ _expected: data.expectedQuoteId } as { _expected?: string }), _replace: data.replacementConfirmed });
    if (error) throw new Error('Quote changed or is unavailable. Reload and confirm replacement.');
    return snapshot;
  });

export const getTripInvoice = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => idInput.parse(v)).handler(async ({ data, context }) => {
    const { data: invoice, error } = await context.supabase.rpc('get_trip_invoice_snapshot', { _invoice: data.invoiceId });
    if (error || !invoice) return null;
    return invoice as unknown as TripInvoice;
  });
export const downloadTripInvoice = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => idInput.parse(v)).handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.rpc('get_trip_invoice_snapshot', { _invoice: data.invoiceId });
    if (!row) throw new Error('Invoice unavailable.');
    const { renderTripInvoicePdf } = await import('./trip-invoice-pdf');
    const bytes = await renderTripInvoicePdf(row as unknown as TripInvoice);
    return { base64: btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')), filename: `${(row as unknown as TripInvoice).mfnId}.pdf` };
  });
export const prepareInvoiceSend = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => idInput.parse(v)).handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc('trip_invoice_access', { _invoice: data.invoiceId, _manage: true });
    if (!allowed) throw new Error('Invoice unavailable.');
    const { data: row } = await context.supabase.from('trip_invoice_documents').select('mfn_id,total_cents,bill_to_snapshot,status').eq('id', data.invoiceId).maybeSingle();
    if (!row) throw new Error('Invoice unavailable.');
    const bill = row.bill_to_snapshot as { email?: string; userId?: string };
    return { recipient: bill.email ?? null, invoiceNumber: row.mfn_id, totalCents: row.total_cents, available: !!bill.userId && !!bill.email && ['ready', 'sent', 'failed'].includes(row.status), blocker: bill.userId ? null : 'Secure non-account invoice links require configuration; no email will be sent.' };
  });
export const sendCustomerInvoice = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => idInput.extend({ confirmed: z.literal(true) }).parse(v)).handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc('trip_invoice_access', { _invoice: data.invoiceId, _manage: true });
    if (!allowed) throw new Error('Invoice unavailable.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: flag } = await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key', 'customer_invoice_email_sends').maybeSingle();
    if (flag?.enabled !== true) return { error: 'Invoice sending is not enabled. Nothing was sent.' };
    const { data: invoice } = await context.supabase.from('trip_invoice_documents').select('*').eq('id', data.invoiceId).maybeSingle();
    if (!invoice || !['ready', 'sent', 'failed'].includes(invoice.status)) return { error: 'Invoice unavailable.' };
    const bill = invoice.bill_to_snapshot as { email?: string; userId?: string };
    if (!bill.userId) return { error: 'Secure non-account invoice links are not configured.' };
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(bill.userId);
    if (!user.user?.email_confirmed_at || !user.user.email) return { error: 'Verified recipient unavailable.' };
    const { sendTemplateEmail } = await import('./email-templates/send-email');
    const result = await sendTemplateEmail('customer-trip-invoice', user.user.email, { idempotencyKey: `customer-invoice:${invoice.id}`, templateData: { invoiceNumber: invoice.mfn_id, providerName: (invoice.provider_snapshot as { name?: string }).name, amountUsd: (invoice.total_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }), invoiceUrl: `https://myfloridanemt.com/portal/invoices/${invoice.id}` } });
    if (!result.sent) return { error: 'Invoice delivery unavailable.' };
    await supabaseAdmin.from('trip_invoice_documents').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice.id);
    await supabaseAdmin.from('trip_invoice_events').insert({ invoice_id: invoice.id, action: 'invoice_sent', actor_id: context.userId });
    return { ok: true };
  });
/** No Stripe call: collection stays closed until the existing verified event path is extended and fees approved. */
export const prepareSecureInvoicePayment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => idInput.parse(v)).handler(async ({ data, context }) => {
    const { data: invoice } = await context.supabase.rpc('get_trip_invoice_snapshot', { _invoice: data.invoiceId });
    if (!invoice) return { error: 'Invoice unavailable.' };
    return { error: 'Secure invoice collection is not enabled. Connected-account payment events and approved customer-processing configuration are required. No payment was created.' };
  });
export const getReferralFundingPreparation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ workspaceId: z.string().uuid(), receiverCents: z.number().int().positive().max(2147483647), environment: z.enum(['sandbox', 'live']) }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc('can_manage_provider_customer_pricing', { _workspace: data.workspaceId });
    if (!allowed) throw new Error('Funding preparation unavailable.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: policies } = await supabaseAdmin.from('network_fee_policies').select('version,percent_bps,fixed_cents,cap_cents,sandbox_estimate').eq('environment', data.environment).eq('method_category', 'card').eq('active', true).order('version', { ascending: false }).limit(1);
    const policy = policies?.[0]; const networkFeeCents = Math.round(data.receiverCents * 200 / 10000);
    if (!policy) return { receiverCents: data.receiverCents, networkFeeCents, processingCents: null, totalCents: null, policyVersion: null, blocker: 'Configured processing recovery unavailable. Funding is not prepared.' };
    const subtotal = data.receiverCents + networkFeeCents;
    let processingCents = Math.ceil((subtotal + policy.fixed_cents) / (1 - policy.percent_bps / 10000)) - subtotal;
    if (policy.cap_cents != null) processingCents = Math.min(processingCents, policy.cap_cents);
    return { receiverCents: data.receiverCents, networkFeeCents, processingCents, totalCents: subtotal + processingCents, policyVersion: policy.version, sandboxEstimate: policy.sandbox_estimate, blocker: 'Preparation only. Existing completion/payment eligibility and controlled Network confirmations remain required.' };
  });
export const setTripDispatchContact = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ workspaceId: z.string().uuid(), phone: z.string().trim().max(32).nullable(), confirmed: z.literal(true) }).strict().parse(v)).handler(async ({ data, context }) => { const { error } = await context.supabase.rpc('set_trip_dispatch_contact', { _workspace: data.workspaceId, _phone: data.phone ?? '', _confirmed: true }); if (error) throw new Error('Contact unavailable.'); return { ok: true }; });
export const setPatientDriverContact = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ tripId: z.string().uuid(), driverId: z.string().uuid(), phone: z.string().trim().max(32).nullable(), providerConfirmed: z.literal(true), driverConfirmed: z.literal(true) }).strict().parse(v)).handler(async ({ data, context }) => { const { error } = await context.supabase.rpc('set_patient_trip_contact', { _trip: data.tripId, _driver: data.driverId, _phone: data.phone ?? '', _provider_confirmed: true, _driver_confirmed: true }); if (error) throw new Error('Contact unavailable.'); return { ok: true }; });