import { createContext, useContext } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, type UseMutationOptions, type UseMutationResult, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";

/** Shared state for Master-Admin portal previews: which kind of portal is
 *  being previewed and whether preview mode is active at all. Consumed by
 *  the real page/panel components so they never read or write real data. */
export type PortalPreviewState = {
  active: boolean;
  kind: "provider" | "customer";
  accountType: string;
};

export const PortalPreviewContext = createContext<PortalPreviewState>({ active: false, kind: "customer", accountType: "general_facility" });

export function usePortalPreview(): PortalPreviewState {
  return useContext(PortalPreviewContext);
}

/** Call from any write path (mutation, inline submit, realtime toggle) that
 *  would otherwise touch the server while a preview is active. */
export function previewBlocked() {
  toast("Preview only — no information was saved");
}

/** Clearly-fake fixtures keyed by the first segment of a react-query queryKey.
 *  Unknown keys fall back to an empty array so panels show their real empty
 *  states instead of crashing. */
const PREVIEW_FIXTURES: Record<string, unknown> = {
  drivers: [
    { id: "preview-driver-1", first_name: "Dana", last_name: "Driverly (Demo)", phone: "(555) 010-0001", email: "dana.demo@example.com", status: "active", employment_type: "employee_w2", pay_type: "hourly", availability: { mode: "weekly", days: {} }, service_capabilities: ["wheelchair"], primary_vehicle_id: "preview-vehicle-1", contractor_pricing: {} },
    { id: "preview-driver-2", first_name: "Sam", last_name: "Sample (Demo)", phone: "(555) 010-0002", email: "", status: "active", employment_type: "independent_contractor", pay_type: "independent_contractor", availability: { mode: "flexible" }, service_capabilities: ["ambulatory"], primary_vehicle_id: null, contractor_pricing: {} },
  ],
  vehicles: [
    { id: "preview-vehicle-1", name: "Van 02 (Demo)", plate: "DEMO01", type: "wheelchair", capacity: 4, status: "active", assigned_driver_id: "preview-driver-1" },
    { id: "preview-vehicle-2", name: "Van 05 (Demo)", plate: "DEMO02", type: "ambulatory", capacity: 4, status: "active", assigned_driver_id: null },
  ],
  "work-hours": { weekly: {} },
  "my-drivers": [],
  "day-reservations": [],
  "reservations-by-state": [],
  "referral-reservations": [],
  "trip-history": [],
  "trip-history-drivers": new Map(),
  "driver-upcoming-trips": { driver: null, trips: [] },
  "driver-earnings": { trips: { completed_count: 0, pickup_legs: 0, total_miles: 0, wait_minutes: 0, canceled_count: 0, worked_hours: 0, worked_days: 0 }, pay_type: null, lines: [], gross_cents: 0, adjustments_cents: 0, amount_paid_cents: 0, outstanding_cents: 0, adjustments: [], payments: [] },
  "driver-payment-history": [],
  "driver-earnings-reports": [],
  "network-providers": [
    { workspace_id: "preview-ws-1", business_name: "Gulfside Rides (Demo)", description: "Demo listing for preview only.", cities: ["Clearwater"], counties: ["Pinellas"], service_types: ["Wheelchair"], medical_delivery: false, accepting_connections: true, is_saved: false, business_contact_email: "", business_contact_phone: "", hours: "" },
  ],
  contacts: [],
  "my-payers": [],
  "payer-cards": [],
  notifications: { rows: [] },
  pricing: null,
  integrations: [],
  "fin-settings": { standard_hold_days: 3, medicaid_net_business_days: 15 },
  "provider-balance-detailed": { balance: { available_cents: 0, pending_cents: 0, lifetime_paid_out_cents: 0 }, entries: [], cashouts: [] },
  "payout-account": { status: "not_connected", payouts_enabled: false, charges_enabled: false, stripe_account_id: null },
  "payout-trips": [],
  "my-network-profile": { ok: true, verified: false, profile: null },
  "my-provider-application": null,
  "hipaa-ack-status": { acknowledged: false, acknowledged_at: null },
  "public-courses": [],
  "my-enrollments": [],
};

export function previewFixtureFor(queryKey: readonly unknown[]): unknown {
  const key = String(queryKey[0] ?? "");
  if (key in PREVIEW_FIXTURES) return PREVIEW_FIXTURES[key];
  return [];
}

/** Drop-in replacement for useQuery: while a preview is active it never calls
 *  the real queryFn (no server/Supabase calls) and serves a seeded fixture
 *  instead, with polling/refetching disabled. Behaves exactly like useQuery
 *  otherwise. */
export function usePortalQuery<TData = unknown, TError = unknown>(
  options: UseQueryOptions<TData, TError> & { queryKey: readonly unknown[] },
): UseQueryResult<TData, TError> {
  const preview = usePortalPreview();
  const effective = preview.active
    ? {
        ...options,
        queryFn: async () => previewFixtureFor(options.queryKey) as TData,
        refetchInterval: false as const,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: false,
      }
    : options;
  return useQuery(effective);
}

/** Drop-in replacement for useMutation: while a preview is active, calling
 *  mutate()/mutateAsync() never reaches the real mutationFn — it shows the
 *  "preview only" toast and rejects quietly instead. */
export function usePortalMutation<TData = unknown, TError = unknown, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const preview = usePortalPreview();
  const effective = preview.active
    ? {
        ...options,
        mutationFn: async () => {
          previewBlocked();
          throw new Error("__PREVIEW_BLOCKED__");
        },
        onError: (err: TError, vars: TVariables, ctx: TContext | undefined) => {
          if (err instanceof Error && err.message === "__PREVIEW_BLOCKED__") return;
          options.onError?.(err, vars, ctx);
        },
        onSuccess: undefined,
        onSettled: undefined,
      }
    : options;
  return useMutation(effective as UseMutationOptions<TData, TError, TVariables, TContext>);
}
