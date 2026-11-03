import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton } from '@/components/ds/controls';
import { getMembershipBilling, setNetworkAddon } from '@/lib/membership.functions';
import { createPortalSession } from '@/utils/payments.functions';
import { ADDON_STATUS_LABEL, BASE_STATUS_LABEL, MEMBERSHIP_PRICING, money } from '@/lib/membership-pricing';
import { getStripeEnvironment } from '@/lib/stripe';
import { useTrainingCart } from '@/components/training/TrainingCart';
import { usePortalPreview, usePortalQuery, previewBlocked } from './preview-data';

const box = 'rounded-ds border border-ds-border bg-ds-surface p-4 sm:p-5';
const soft = 'rounded-ds bg-ds-surface-muted p-4 sm:p-5';
const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium' }) : 'Not Available');

function envOrNull() { try { return getStripeEnvironment(); } catch { return null; } }

export function MembershipBilling({ workspaceId, role }: { workspaceId: string; role: string }) {
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const env = envOrNull();
  const get = useServerFn(getMembershipBilling);
  const addon = useServerFn(setNetworkAddon);
  const portal = useServerFn(createPortalSession);
  const q = usePortalQuery({ queryKey: ['membership-billing', workspaceId], queryFn: () => get({ data: { environment: env!, workspaceId } }), enabled: !!env || preview.active });
  const [confirm, setConfirm] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);
  const cart = useTrainingCart();
  const addToCart = (network: boolean) => { if (preview.active) return previewBlocked(); cart.setMembership({ base: true, network, baseActive: false, addonActive: false, trialEligible: !s?.trialEnd }); cart.open(); };
  const owner = role === 'owner';
  const d = q.data as Awaited<ReturnType<typeof getMembershipBilling>> | undefined;
  const s = d?.summary;
  const disabledReason = preview.active ? 'Not available in preview.' : !env ? 'Payments are not configured for this build.' : !owner ? 'Only the business owner can change membership billing.' : null;

  async function toggle(enabled: boolean) {
    if (preview.active) return previewBlocked();
    setBusy(true);
    try {
      const r = await addon({ data: { environment: env!, workspaceId, enabled } });
      if ('error' in r) throw new Error(r.error);
      toast.success(enabled ? 'Referral Network add-on added.' : r.effectiveAt ? `Add-on ends ${date(r.effectiveAt)}.` : 'Add-on removed.');
      setConfirm(null);
      await qc.invalidateQueries({ queryKey: ['membership-billing', workspaceId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Change unavailable.'); } finally { setBusy(false); }
  }
  async function manage() {
    if (preview.active) return previewBlocked();
    setBusy(true);
    try {
      const r = await portal({ data: { environment: env!, returnUrl: window.location.href } });
      if ('error' in r) throw new Error(r.error);
      window.open(r.url, '_blank');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Billing management unavailable.'); } finally { setBusy(false); }
  }

  if (q.isLoading) return <p role="status" className="ds-support">Loading membership…</p>;
  if (q.isError || !s) return <section className="space-y-3"><h2 className="ds-subheading uppercase text-ds-primary">Membership & billing</h2><p className="ds-support">{disabledReason ?? 'Membership details are not available right now.'}</p></section>;

  const addonOn = ['trialing', 'active', 'past_due'].includes(s.addon);
  return (
    <section className="space-y-5" aria-labelledby="mb-h">
      <h2 id="mb-h" className="ds-subheading uppercase text-ds-primary">Membership & billing</h2>
      {s.needsReviewReason && <p role="status" className={`${soft} ds-body`}><strong>Needs Review:</strong> {s.needsReviewReason}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <article className={box}>
          <h3 className="ds-label text-ds-primary">Base Provider Membership</h3>
          <p className="ds-heading mt-1">{money(s.items[0]?.cents && !s.legacy ? s.items[0].cents : MEMBERSHIP_PRICING.baseCents)}<span className="ds-support"> /month</span></p>
          <dl className="ds-body mt-3 space-y-1">
            <div><dt className="inline font-semibold">Status: </dt><dd className="inline">{s.cancelAtPeriodEnd && s.base !== 'canceled' ? 'Canceling' : BASE_STATUS_LABEL[s.base]}</dd></div>
            <div><dt className="inline font-semibold">Trial ends: </dt><dd className="inline">{date(s.trialEnd)}</dd></div>
            <div><dt className="inline font-semibold">Renews: </dt><dd className="inline">{date(s.renewalAt)}</dd></div>
          </dl>
          {s.legacy && <p className="ds-support mt-3">Your former $10 membership keeps Referral Network access through your current paid billing period. Any change at renewal is prepared but not active.</p>}
          {s.base === 'none' && <div className="mt-4 flex flex-wrap gap-2">
            <DsButton size="sm" disabled={!!disabledReason} onClick={() => addToCart(false)}>Add membership to cart</DsButton>
            <DsButton size="sm" variant="secondary" disabled={!!disabledReason} onClick={() => addToCart(true)}>Add with Network add-on</DsButton>
          </div>}
        </article>
        <article className={box}>
          <h3 className="ds-label text-ds-primary">Referral Network add-on</h3>
          <p className="ds-heading mt-1">{money(MEMBERSHIP_PRICING.networkCents)}<span className="ds-support"> /month, optional</span></p>
          <p className="ds-body mt-3"><span className="font-semibold">Status: </span>{s.legacy ? 'Included until renewal transition' : ADDON_STATUS_LABEL[s.addon]}</p>
          {s.addon === 'canceling' && <p className="ds-support">Access continues until {date(s.addonCancelAt)}.</p>}
          {!s.legacy && s.linked && (s.base === 'active' || s.base === 'trialing') && (
            confirm === null ? (
              <DsButton className="mt-4" size="sm" variant={addonOn ? 'secondary' : 'primary'} disabled={!!disabledReason || busy || s.addon === 'canceling'} onClick={() => setConfirm(!addonOn)}>{addonOn ? 'Cancel add-on' : 'Add Referral Network'}</DsButton>
            ) : (
              <div className={`${soft} mt-4 space-y-3`} role="alertdialog" aria-label="Confirm add-on change">
                <p className="ds-body">{confirm ? `Add the Referral Network for ${money(MEMBERSHIP_PRICING.networkCents)}/month to your existing membership? No second subscription is created.` : 'Cancel the Referral Network add-on? Access continues until the end of the current paid period.'}</p>
                <div className="flex gap-2"><DsButton size="sm" disabled={busy} onClick={() => toggle(confirm)}>{busy ? 'Working…' : 'Confirm'}</DsButton><DsButton size="sm" variant="ghost" onClick={() => setConfirm(null)}>Keep as is</DsButton></div>
              </div>
            )
          )}
        </article>
      </div>
      {disabledReason && <p className="ds-support">{disabledReason}</p>}

      <div className={soft}>
        <h3 className="ds-label text-ds-primary">Recurring total</h3>
        {s.items.length ? <ul className="ds-body mt-2 space-y-1">{s.items.map(i => <li key={i.label} className="flex justify-between gap-4"><span>{i.label}</span><span>{money(i.cents)}</span></li>)}<li className="flex justify-between gap-4 border-t border-ds-border pt-1 font-semibold"><span>Total per month</span><span>{money(s.totalCents)}</span></li></ul> : <p className="ds-support mt-2">No recurring charges.</p>}
        <p className="ds-caption mt-3">Provider Base Membership $20/month; optional Referral Network add-on $10/month (requires the base membership); $30/month with both before usage fees. The 2% Network fee applies only to applicable referral transactions. Courses are separate one-time purchases. Prices are subject to change.</p>
      </div>

      {s.transition && <div className={box}><h3 className="ds-label text-ds-primary">Pending renewal transition</h3><p className="ds-body mt-2">{s.transition.currentCents != null ? money(s.transition.currentCents) : '—'} → {money(s.transition.proposedCents)} at {date(s.transition.renewalAt)}. Status: {s.transition.status}. Not active until launch approval.</p></div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className={box}>
          <h3 className="ds-label text-ds-primary">Payment method</h3>
          {d?.card ? <p className="ds-body mt-2 capitalize">{d.card.brand} •••• {d.card.last4} · exp {String(d.card.expMonth).padStart(2, '0')}/{d.card.expYear}</p> : <p className="ds-support mt-2">{owner ? 'No card on file.' : 'Visible to the business owner only.'}</p>}
          <DsButton className="mt-3" size="sm" variant="secondary" disabled={!!disabledReason || busy || !s.stripeLinked} onClick={manage}>Manage billing</DsButton>
          {!s.stripeLinked && !disabledReason && <p className="ds-caption mt-2">Available after your membership is linked to billing.</p>}
        </div>
        <div className={box}>
          <h3 className="ds-label text-ds-primary">Invoices</h3>
          {d?.stripeError && <p role="alert" className="ds-support mt-2">{d.stripeError}</p>}
          {d?.invoices === null ? <p className="ds-support mt-2">Visible to the business owner only.</p> : d?.invoices?.length ? (
            <ul className="ds-body mt-2 divide-y divide-ds-border">{d.invoices.map((i, n) => <li key={i.number ?? n} className="flex flex-wrap justify-between gap-2 py-2"><span>{date(i.created)} · {i.status ?? '—'}</span><span>{money(i.amountCents)}{i.url && <> · <a className="text-ds-link underline" href={i.url} target="_blank" rel="noopener noreferrer">View</a></>}</span></li>)}</ul>
          ) : <p className="ds-support mt-2">No invoices yet.</p>}
        </div>
      </div>
    </section>
  );
}
