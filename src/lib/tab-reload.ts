import type { QueryClient } from "@tanstack/react-query";

/**
 * Tabs whose data must be pulled fresh from the database every time the user
 * selects them in the left sidebar (Reservations, Schedule, Referrals and
 * their admin/dispatch equivalents).
 */
const RELOAD_ON_SELECT = new Set([
  // Provider / patient / facility portal
  "reservations",
  "trips",
  "schedule",
  "received",
  // Admin / dispatch portal
  "direct-referrals",
  "dispatch",
]);

export function shouldReloadTab(tabId: string) {
  return RELOAD_ON_SELECT.has(tabId);
}

/**
 * Full data reload for the current view — equivalent to reloading the page,
 * but without losing the selected tab. Marks every cached query stale and
 * immediately refetches the ones mounted on screen.
 */
export function reloadTabData(qc: QueryClient, tabId: string) {
  if (!shouldReloadTab(tabId)) return;
  void qc.invalidateQueries();
  void qc.refetchQueries({ type: "active" });
}
