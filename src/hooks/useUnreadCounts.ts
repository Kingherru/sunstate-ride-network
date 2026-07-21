import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getUnreadCounts, markTabViewed, SEVERITY, type TabKey, type Severity } from "@/lib/unread.functions";

type CountsShape = { counts: Partial<Record<TabKey, number>>; severities: Record<TabKey, Severity> };

/**
 * Load per-tab unread counts + severities and keep them fresh in real time.
 * Subscribes to inserts/updates on every source table so badges update
 * without a page refresh.
 */
export function useUnreadCounts(userId: string | null): Partial<Record<TabKey, number>> {
  const qc = useQueryClient();
  const fetchCounts = useServerFn(getUnreadCounts);

  const q = useQuery<CountsShape>({
    queryKey: ["unread-counts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const r = await fetchCounts();
      return r.ok
        ? { counts: r.counts, severities: r.severities }
        : { counts: {}, severities: SEVERITY };
    },
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!userId) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["unread-counts", userId] });
    const channel = supabase
      .channel(`unread-counts-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_requests" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_payments" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "fin_payouts" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_applications" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_credentials" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_profiles" }, invalidate)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);

  return q.data?.counts ?? {};
}

/**
 * Static severity lookup — the sidebar uses this to color badges.
 * Kept as a plain export (not a hook) so components can call it without
 * subscribing to state.
 */
export function severityFor(key: TabKey): Severity {
  return SEVERITY[key];
}

/**
 * Record that the user just opened a tab, clearing its unread badge.
 */
export function useMarkTabViewed(userId: string | null) {
  const qc = useQueryClient();
  const mark = useServerFn(markTabViewed);
  return (tab_key: TabKey) => {
    if (!userId) return;
    qc.setQueryData<CountsShape>(["unread-counts", userId], (old) => ({
      counts: { ...(old?.counts ?? {}), [tab_key]: 0 },
      severities: old?.severities ?? SEVERITY,
    }));
    void mark({ data: { tab_key } }).then(() => {
      qc.invalidateQueries({ queryKey: ["unread-counts", userId] });
    });
  };
}
