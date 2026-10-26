import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DsButton } from '@/components/ds/controls';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { eligibleCartItems, type CartCourse } from '@/lib/training/cart-rules';
import { createTrainingCheckout } from '@/lib/training/cart.functions';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import { supabase } from '@/integrations/supabase/client';
import { usePortalPreview, previewBlocked } from '@/components/portal/preview-data';

type CartState = { items: CartCourse[]; add: (item: CartCourse, ownedIds: string[]) => void; open: () => void; remove: (id: string) => void };
const CartContext = createContext<CartState>({ items: [], add: () => {}, open: () => {}, remove: () => {} });
export const useTrainingCart = () => useContext(CartContext);

function Checkout({ ids }: { ids: string[] }) {
  const create = useServerFn(createTrainingCheckout);
  const fetchClientSecret = useCallback(async () => {
    const result = await create({ data: { courseIds: ids, environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/shop/return?session_id={CHECKOUT_SESSION_ID}` } });
    if ('error' in result) throw new Error(result.error);
    return result.clientSecret;
  }, [create, ids]);
  return <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider>;
}

export function TrainingCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartCourse[]>([]);
  const [open, setOpen] = useState(false);
  const [checkoutIds, setCheckoutIds] = useState<string[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') { setSignedIn(!!session); setItems([]); setCheckoutIds(null); setOpen(false); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return <CartContext.Provider value={{ items, add: (item, ownedIds) => setItems(prev => eligibleCartItems([...prev, item], ownedIds)), open: () => setOpen(true), remove: id => setItems(prev => prev.filter(c => c.id !== id)) }}>
    {children}
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setCheckoutIds(null); setError(''); } }}>
      <DialogContent className="theme-portal max-h-[92dvh] !max-w-3xl overflow-y-auto">
        <DialogTitle className="pr-8 text-ds-primary">Training cart</DialogTitle><DialogDescription className="sr-only">Selected courses and secure checkout</DialogDescription>
        {!items.length ? <p className="ds-body">Your cart is empty.</p> : <>
          <ul className="divide-y divide-ds-border">{items.map(c => <li key={c.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="ds-label">{c.title}</p><p className="ds-support">${(c.price_cents / 100).toFixed(2)}</p></div><DsButton variant="ghost" size="sm" aria-label={`Remove ${c.title}`} disabled={!!checkoutIds} onClick={() => setItems(prev => prev.filter(i => i.id !== c.id))}><Trash2 className="size-4" /></DsButton></li>)}</ul>
          <p className="ds-subheading">Total: ${(items.reduce((s, c) => s + c.price_cents, 0) / 100).toFixed(2)}</p>
          {!signedIn ? <Link to="/login" className="text-ds-link underline">Sign in to purchase</Link> : !checkoutIds && <DsButton onClick={() => { try { getStripeEnvironment(); setCheckoutIds(items.map(c => c.id)); } catch (e) { setError(e instanceof Error ? e.message : 'Checkout unavailable'); } }}>Continue to checkout</DsButton>}
          {error && <p role="alert" className="text-ds-error">{error}</p>}
          {checkoutIds && <><PaymentTestModeBanner /><Checkout ids={checkoutIds} /></>}
        </>}
      </DialogContent>
    </Dialog>
  </CartContext.Provider>;
}

export function TrainingCartIcon({ onBlue = true }: { onBlue?: boolean }) {
  const cart = useTrainingCart();
  const preview = usePortalPreview();
  return <DsButton variant="ghost" size="sm" aria-label="Training cart" title="Cart" onClick={preview.active ? previewBlocked : cart.open} className={`relative !size-10 !min-h-10 !p-0 ${onBlue ? '!text-ds-on-primary hover:!bg-ds-primary-hover' : ''}`}><ShoppingCart className="size-5" />{cart.items.length > 0 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-ds-sm bg-ds-action text-xs text-ds-on-action">{cart.items.length}</span>}</DsButton>;
}