import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Referral payout is a platform-wide, admin-controlled percentage.
 * Providers can never read or change the percentage — they only ever see the
 * dollar amount the system calculated for a given trip.
 */
export const MAX_REFERRAL_FEE_PCT = 0.1; // hard cap: 10%

async function readPct(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.rpc("get_referral_fee_pct");
  const n = Number(data);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_REFERRAL_FEE_PCT);
}

async function isAdmin(context: { supabase: any; userId: string }): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return data === true;
}

/** Admin-only: read the current referral payout percentage (0–10). */
export const getReferralFeeSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context as any))) throw new Error("Forbidden");
    const pct = await readPct();
    return { pct, percent: +(pct * 100).toFixed(2), maxPercent: MAX_REFERRAL_FEE_PCT * 100 };
  });

/** Admin-only: update the referral payout percentage (capped at 10%). */
export const setReferralFeePercent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { percent: number }) =>
    z.object({ percent: z.number().min(0).max(MAX_REFERRAL_FEE_PCT * 100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context as any))) throw new Error("Forbidden");
    const pct = Math.min(Math.max(data.percent / 100, 0), MAX_REFERRAL_FEE_PCT);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .update({ referral_fee_pct: pct, updated_by: context.userId } as any)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { pct, percent: +(pct * 100).toFixed(2) };
  });

/**
 * Any signed-in user: the system-calculated referral payout in cents for a
 * given trip amount. Returns the amount only — never the percentage.
 */
export const computeReferralPayoutCents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amountCents: number }) =>
    z.object({ amountCents: z.number().min(0).max(100_000_00) }).parse(input),
  )
  .handler(async ({ data }) => {
    const pct = await readPct();
    return { cents: Math.round(Math.max(0, data.amountCents) * pct) };
  });
