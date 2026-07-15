import { createServerFn } from "@tanstack/react-start";
import { PLATFORM_FEE_PCT as DEFAULT_PCT } from "@/lib/payouts";

/**
 * Returns only the platform fee percentage. Reading it does not require a session:
 * the value is a single non-sensitive number surfaced in the payouts UI for every
 * signed-in provider, and gets used by public price previews too.
 */
export const getPlatformFeePct = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("platform_fee_pct")
    .eq("id", true)
    .maybeSingle();
  const n = Number(data?.platform_fee_pct);
  return { pct: Number.isFinite(n) ? n : DEFAULT_PCT };
});
