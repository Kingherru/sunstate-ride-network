import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from '@/lib/stripe.server';

export type PaymentHistoryRow = { description: string | null; status: string; amountCents: number; currency: string; created: string; receiptUrl: string | null };

/** Read-only payment history for the signed-in person's own Stripe customer records. Never returns Stripe IDs. */
export const listMyPaymentHistory = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ environment: z.enum(['sandbox', 'live']) }).parse(i))
  .handler(async ({ data, context }): Promise<{ rows: PaymentHistoryRow[] } | { error: string }> => {
    try {
      if (!/^[a-zA-Z0-9_-]+$/.test(context.userId)) return { rows: [] };
      const stripe = createStripeClient(data.environment as StripeEnv);
      const found = await stripe.customers.search({ query: `metadata['userId']:'${context.userId}'`, limit: 5 });
      const rows: PaymentHistoryRow[] = [];
      for (const c of found.data) {
        const charges = await stripe.charges.list({ customer: c.id, limit: 25 });
        for (const ch of charges.data) rows.push({ description: ch.description ?? null, status: ch.refunded ? 'refunded' : ch.status, amountCents: ch.amount, currency: ch.currency, created: new Date(ch.created * 1000).toISOString(), receiptUrl: ch.receipt_url ?? null });
      }
      rows.sort((a, b) => b.created.localeCompare(a.created));
      return { rows };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
