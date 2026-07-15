import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_FEE_PCT as DEFAULT_PCT } from "@/lib/payouts";

export function usePlatformFeePct(): number {
  const { data } = useQuery({
    queryKey: ["platform-fee-pct"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_platform_fee_pct");
      const n = Number(data);
      return Number.isFinite(n) ? n : DEFAULT_PCT;
    },
  });
  return typeof data === "number" ? data : DEFAULT_PCT;
}
