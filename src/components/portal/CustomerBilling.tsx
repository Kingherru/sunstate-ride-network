import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsCheckbox, DsField, DsSelect } from '@/components/ds/controls';
import { SavedCards } from '@/components/payments/SavedCards';
import { getPortalPreferences, savePortalPreferences, type PortalPreferences } from '@/lib/portal-preferences.functions';
import { listMyPayers } from '@/lib/payers.functions';
import { listSavedPaymentMethods } from '@/lib/saved-payments.functions';
import { listMyPaymentHistory } from '@/lib/billing-history.functions';
import { getStripeEnvironment } from '@/lib/stripe';
import { money } from '@/lib/membership-pricing';
import { usePortalPreview, usePortalQuery, previewBlocked } from './preview-data';

const box = 'rounded-ds border border-ds-border bg-ds-surface p-4 sm:p-5';
function envOrNull() { try { return getStripeEnvironment(); } catch { return null; } }

/** Defaults and preferences; never charges, marks invoices paid or grants credit. */
export function BillingDefaults({ showPaymentMethod = true }: { showPaymentMethod?: boolean }) {
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const getPrefs = useServerFn(getPortalPreferences);
  const save = useServerFn(savePortalPreferences);
  const getPayers = useServerFn(listMyPayers);
  const getCards = useServerFn(listSavedPaymentMethods);
  const prefs = usePortalQuery({ queryKey: ['portal-preferences'], queryFn: () => getPrefs() });
  const payers = usePortalQuery({ queryKey: ['my-payers'], queryFn: () => getPayers() });
  const cards = usePortalQuery({ queryKey: ['saved-cards'], queryFn: () => getCards(), enabled: showPaymentMethod });
  const p = prefs.data as PortalPreferences | undefined;
  async function update(patch: Parameters<typeof save>[0]['data']) {
    if (preview.active) return previewBlocked();
    try { await save({ data: patch }); await qc.invalidateQueries({ queryKey: ['portal-preferences'] }); toast.success('Billing preference saved.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save.'); }
  }
  const payerRows = ((payers.data as any[]) ?? []).filter(x => x.active !== false);
  const cardRows = (cards.data as any[]) ?? [];
  return (
    <div className={`${box} space-y-4`}>
      <h3 className="ds-label text-ds-primary">Billing defaults</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <DsField label="Default payer">{f => <DsSelect {...f} value={p?.default_payer_id ?? ''} disabled={!p} onChange={e => update({ default_payer_id: e.target.value || null })}><option value="">No default payer</option>{payerRows.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</DsSelect>}</DsField>
        {showPaymentMethod && <DsField label="Default payment method">{f => <DsSelect {...f} value={p?.default_payment_method_id ?? ''} disabled={!p} onChange={e => update({ default_payment_method_id: e.target.value || null })}><option value="">No default card</option>{cardRows.map(c => <option key={c.id} value={c.id}>{(c.brand ?? 'Card')} •••• {c.last4}</option>)}</DsSelect>}</DsField>}
      </div>
      <div>
        <DsCheckbox label="Pay by Invoice" checked={!!p?.pay_by_invoice} disabled={!p?.invoiceEligible} onChange={e => update({ pay_by_invoice: e.target.checked })} />
        <p className="ds-caption mt-1">{p && !p.invoiceEligible ? 'Only the account owner or a workspace owner/admin can change this.' : 'A preference only. It does not mark invoices paid, grant credit or charge anyone.'}</p>
      </div>
    </div>
  );
}

export function PaymentHistory() {
  const env = envOrNull();
  const get = useServerFn(listMyPaymentHistory);
  const q = usePortalQuery({ queryKey: ['my-payment-history'], queryFn: () => get({ data: { environment: env! } }), enabled: !!env });
  const d = q.data as Awaited<ReturnType<typeof listMyPaymentHistory>> | undefined;
  const rows = d && 'rows' in d ? d.rows : [];
  return (
    <div className={box}>
      <h3 className="ds-label text-ds-primary">Invoice & payment history</h3>
      {!env ? <p className="ds-support mt-2">Payments are not configured for this build.</p> : q.isLoading ? <p role="status" className="ds-support mt-2">Loading…</p> : d && 'error' in d ? <p role="alert" className="ds-support mt-2">{d.error}</p> : rows.length ? (
        <ul className="ds-body mt-2 divide-y divide-ds-border">{rows.map((r, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-2"><span>{new Date(r.created).toLocaleDateString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium' })} · {r.description ?? 'Payment'} · {r.status}</span><span>{money(r.amountCents)}{r.receiptUrl && <> · <a className="text-ds-link underline" href={r.receiptUrl} target="_blank" rel="noopener noreferrer">Receipt</a></>}</span></li>)}</ul>
      ) : <p className="ds-support mt-2">No payments yet.</p>}
    </div>
  );
}

export function CustomerBilling() {
  const preview = usePortalPreview();
  return (
    <section className="space-y-5" aria-labelledby="cb-h">
      <h2 id="cb-h" className="ds-subheading uppercase text-ds-primary">Billing</h2>
      <div className={box}>{preview.active ? <p className="ds-support">Saved cards are not available in preview.</p> : <SavedCards />}</div>
      <BillingDefaults />
      <PaymentHistory />
      <p className="ds-caption">Only card brand, last four digits, expiration and default status are shown. No charge is made from this page.</p>
    </section>
  );
}
