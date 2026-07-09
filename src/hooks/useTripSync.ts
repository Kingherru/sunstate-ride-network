import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cross-tab realtime sync for Reservations, Schedule, Referrals, and Trip History.
 *
 * These four surfaces read from `trips` and `ride_requests` under different
 * query keys (`my-trips`, `my-reservations`, `incoming-requests`,
 * `day-reservations`, `work-hours`, etc.), so a status change made in one tab
 * previously did not refresh the others. Subscribing here once and
 * invalidating every related key keeps all four tabs in sync in real time.
 */
const KEYS = [
  "my-trips",
  "my-reservations",
  "incoming-requests",
  "day-reservations",
  "provider-schedule",
  "regional-providers",
  "trip-payments",
];

export function useTripSync(userId: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const invalidateAll = () => {
      for (const k of KEYS) qc.invalidateQueries({ queryKey: [k] });
    };

    const channel = supabase
      .channel(`trip-sync-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        invalidateAll,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests" },
        invalidateAll,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
