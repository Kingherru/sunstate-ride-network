import { useQuery } from "@tanstack/react-query";
import { PLATFORM_FEE_PCT as DEFAULT_PCT } from "@/lib/payouts";
import { getPlatformFeePct } from "@/lib/platform-fee.functions";

export function usePlatformFeePct(): number {
  const { data } = useQuery({
    queryKey: ["platform-fee-pct"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await getPlatformFeePct();
      const n = Number(res?.pct);
      return Number.isFinite(n) ? n : DEFAULT_PCT;
    },
  });
  return typeof data === "number" ? data : DEFAULT_PCT;
}

