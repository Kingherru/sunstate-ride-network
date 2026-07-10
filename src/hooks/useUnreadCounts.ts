import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getUnreadCounts, markTabViewed, type TabKey } from "@/lib/unread.functions";

/**
 * Load per-tab unread counts for the current user and keep them fresh in
 * real time. Subscribes to inserts/updates on `ride_requests` and `trips`
 * and invalidates the query so the sidebar badges update instantly.
 */
export function useUnreadCounts(userId: string | null) {
  const qc = useQueryClient();
  const fetchCounts = useServerFn(getUnreadCounts);

  const q = useQuery({
    queryKey: ["unread-counts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const r = await fetchCounts();
      return r.ok ? r.counts : {};
    },
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`unread-counts-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ride_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["unread-counts", userId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trips" }, () => {
        qc.invalidateQueries({ queryKey: ["unread-counts", userId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ride_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["unread-counts", userId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  return q.data ?? {};
}

/**
 * Record that the user just opened a tab, clearing its unread badge.
 * Safe to call from click handlers even before the mark upsert resolves;
 * the sidebar optimistically hides the badge via query cache mutation.
 */
export function useMarkTabViewed(userId: string | null) {
  const qc = useQueryClient();
  const mark = useServerFn(markTabViewed);
  return (tab_key: TabKey) => {
    if (!userId) return;
    qc.setQueryData(["unread-counts", userId], (old: Partial<Record<TabKey, number>> | undefined) => ({
      ...(old ?? {}),
      [tab_key]: 0,
    }));
    void mark({ data: { tab_key } }).then(() => {
      qc.invalidateQueries({ queryKey: ["unread-counts", userId] });
    });
  };
}
