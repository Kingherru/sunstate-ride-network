import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DsButton } from '@/components/ds/controls';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { eligibleCartItems, type CartCourse } from '@/lib/training/cart-rules';
import { createCommerceCheckout } from '@/lib/commerce.functions';
import { commerceTotals, confirmationComplete, normalizeSelection, type Confirmation } from '@/lib/commerce-rules';
import { MEMBERSHIP_PRICING } from '@/lib/membership-pricing';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { usePortalPreview, previewBlocked } from '@/components/portal/preview-data';
import { CheckoutErrorBoundary } from './CheckoutErrorBoundary';

type Membership = { base: boolean; network: boolean; baseActive: boolean; addonActive: boolean; trialEligible: boolean };
type CartState = { items: CartCourse[]; membership: Membership; add: (item: CartCourse, ownedIds: string[]) => void; setMembership: (m: Partial<Membership>) => void; open: () => void; remove: (id: string) => void };
const emptyMembership: Membership = { base: false, network: false, baseActive: false, addonActive: false, trialEligible: true };
const CartContext = createContext<CartState>({ items: [], membership: emptyMembership, add: () => {}, setMembership: () => {}, open: () => {}, remove: () => {} });
export const useTrainingCart = () => useContext(CartContext);
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

type CheckoutReq = { base: boolean; network: boolean; ids: string[]; confirm: Confirmation };
function Checkout({ req }: { req: CheckoutReq }) {
  const create = useServerFn(createCommerceCheckout);
  const fetchClientSecret = useCallback(async () => {
    const result = await create({ data: { base: req.base, network: req.network, courseIds: req.ids, confirm: req.confirm, environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/shop/return?session_id={CHECKOUT_SESSION_ID}` } });
    if ('error' in result) throw new Error(result.error);
    return result.clientSecret;
  }, [create, req]);
  return <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider>;
}

function Line({ label, kind, cents, onRemove, locked }: { label: string; kind: string; cents: number; onRemove: () => void; locked: boolean }) {
  return <li className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="ds-label">{label}</p><p className="ds-support"><span className="portal-money">{usd(cents)}</span> · {kind}</p></div><DsButton variant="ghost" size="sm" aria-label={`Remove ${label}`} disabled={locked} onClick={onRemove}><Trash2 className="size-4" /></DsButton></li>;
}

export function TrainingCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartCourse[]>([]);
  const [membership, setM] = useState<Membership>(emptyMembership);
  const [open, setOpen] = useState(false);
  const [req, setReq] = useState<CheckoutReq | null>(null);
  const [confirm, setConfirm] = useState<Confirmation>({ recurring: false, oneTime: false, terms: false });
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') { setSignedIn(!!session); setItems([]); setM(emptyMembership); setReq(null); setOpen(false); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const sel = normalizeSelection({ base: membership.base, network: membership.network, courses: items }, { ownedCourseIds: [], baseActive: membership.baseActive, addonActive: membership.addonActive });
  const totals = commerceTotals(sel, membership.trialEligible);
  const count = sel.courses.length + (sel.base ? 1 : 0) + (sel.network ? 1 : 0);
  const hasRecurring = sel.base || sel.network;
  const ready = confirmationComplete(sel, confirm);
  const setMembership = (m: Partial<Membership>) => setM(prev => {
    const next = { ...prev, ...m };
    if (!next.base && !next.baseActive) next.network = false; // add-on never stands alone
    return next;
  });
  const check = (k: keyof Confirmation) => (e: React.ChangeEvent<HTMLInputElement>) => setConfirm(c => ({ ...c, [k]: e.target.checked }));
  return <CartContext.Provider value={{ items, membership, setMembership, add: (item, ownedIds) => setItems(prev => eligibleCartItems([...prev, item], ownedIds)), open: () => setOpen(true), remove: id => setItems(prev => prev.filter(c => c.id !== id)) }}>
    {children}
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setReq(null); setError(''); } }}>
      <DialogContent className="theme-portal max-h-[92dvh] !max-w-3xl overflow-y-auto">
        <DialogTitle className="pr-8 text-ds-primary">Your cart</DialogTitle><DialogDescription className="sr-only">Selected membership items, courses and secure checkout</DialogDescription>
        {!count ? <p className="ds-body">Your cart is empty.</p> : <>
          <ul className="divide-y divide-ds-border">
            {sel.base && <Line label="Provider Base Membership" kind="monthly" cents={MEMBERSHIP_PRICING.baseCents} locked={!!req} onRemove={() => setMembership({ base: false })} />}
            {sel.network && <Line label="Referral Network Add-On" kind="monthly, requires base membership" cents={MEMBERSHIP_PRICING.networkCents} locked={!!req} onRemove={() => setMembership({ network: false })} />}
            {sel.courses.map(c => <Line key={c.id} label={c.title} kind="one-time" cents={c.price_cents} locked={!!req} onRemove={() => setItems(prev => prev.filter(i => i.id !== c.id))} />)}
          </ul>
          {sel.notices.map(n => <p key={n} role="status" className="ds-support">{n}</p>)}
          <dl className="ds-body space-y-1 rounded-ds border border-ds-border bg-ds-surface p-4">
            {hasRecurring && <div className="flex justify-between gap-4"><dt>Monthly total</dt><dd className="font-semibold"><span className="portal-money">{usd(totals.recurringCents)}</span>/month</dd></div>}
            {sel.courses.length > 0 && <div className="flex justify-between gap-4"><dt>One-time training total</dt><dd className="font-semibold"><span className="portal-money">{usd(totals.oneTimeCents)}</span></dd></div>}
            <div className="flex justify-between gap-4 border-t border-ds-border pt-1"><dt className="font-semibold">Due at checkout{sel.base && membership.trialEligible ? ' (30-day trial if eligible)' : ''}</dt><dd className="font-semibold"><span className="portal-money">{usd(totals.dueTodayCents)}</span></dd></div>
          </dl>
          {hasRecurring && <p className="ds-caption">The 2% Network fee applies only to applicable referral transactions; it is not charged for joining. Future monthly charges exclude separately incurred Network transaction fees. Prices and plan availability are subject to change. If you already used a trial, billing starts today.</p>}
          {!signedIn ? <Link to="/login" className="text-ds-link underline">Sign in to purchase</Link> : !req && <fieldset className="space-y-2">
            <legend className="ds-label">Confirm before checkout</legend>
            {hasRecurring && <label className="ds-body flex items-start gap-2"><input type="checkbox" className="mt-1" checked={confirm.recurring} onChange={check('recurring')} />I confirm the monthly membership items listed above.</label>}
            {sel.courses.length > 0 && <label className="ds-body flex items-start gap-2"><input type="checkbox" className="mt-1" checked={confirm.oneTime} onChange={check('oneTime')} />I confirm the separate one-time course purchases listed above.</label>}
            <label className="ds-body flex items-start gap-2"><input type="checkbox" className="mt-1" checked={confirm.terms} onChange={check('terms')} /><span>I accept the <Link to="/terms" className="text-ds-link underline">Terms</Link> and the payment and cancellation policies.</span></label>
            <DsButton disabled={!ready} onClick={() => { try { getStripeEnvironment(); setReq({ base: sel.base, network: sel.network, ids: sel.courses.map(c => c.id), confirm }); } catch (e) { setError(e instanceof Error ? e.message : 'Checkout unavailable'); } }}>Continue to checkout</DsButton>
          </fieldset>}
          {error && <p role="alert" className="text-ds-error">{error}</p>}
          {req && <><PaymentTestModeBanner /><CheckoutErrorBoundary><Checkout req={req} /></CheckoutErrorBoundary></>}
        </>}
      </DialogContent>
    </Dialog>
  </CartContext.Provider>;
}

export function TrainingCartIcon({ onBlue = true }: { onBlue?: boolean }) {
  const cart = useTrainingCart();
  const preview = usePortalPreview();
  return <DsButton variant="ghost" size="sm" aria-label="Training cart" title="Cart" onClick={preview.active ? previewBlocked : cart.open} className={`portal-header-cart relative !size-10 !min-h-10 !p-0 ${onBlue ? '!text-ds-on-primary hover:!bg-ds-primary-hover' : ''}`}><ShoppingCart className="size-5" />{(cart.items.length + (cart.membership.base ? 1 : 0) + (cart.membership.network ? 1 : 0)) > 0 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-ds-sm bg-ds-action text-xs font-bold text-ds-on-action">{cart.items.length + (cart.membership.base ? 1 : 0) + (cart.membership.network ? 1 : 0)}</span>}</DsButton>;
}