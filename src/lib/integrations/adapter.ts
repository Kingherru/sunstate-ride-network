/**
 * External dispatch system adapter interface.
 * Each vendor (hiBambi, RouteGenie, …) implements this contract so the rest
 * of the app can push/pull trips without caring about the wire format.
 *
 * Implementations live next to this file (e.g. ./hibambi.ts, ./routegenie.ts)
 * and are wired into `getAdapter(vendor)` below.
 */
export type Vendor = "hibambi" | "routegenie" | "dueride";

export interface ExternalTrip {
  external_id: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_phone?: string;
  pickup_address: string;
  pickup_city: string;
  pickup_zip?: string;
  pickup_date: string; // YYYY-MM-DD
  pickup_time: string; // HH:MM
  dropoff_address: string;
  dropoff_city: string;
  dropoff_zip?: string;
  transport_type?: "ambulatory" | "wheelchair" | "stretcher";
  payer?: string;
  trip_number?: string;
}

export interface IntegrationConfig {
  apiKey: string;
  webhookSecret?: string;
  baseUrl?: string;
  config?: Record<string, unknown>;
}

export interface IntegrationAdapter {
  vendor: Vendor;
  /** Push a trip outbound to the vendor (we sent it, vendor receives). */
  pushTrip(trip: ExternalTrip, cfg: IntegrationConfig): Promise<{ external_id: string }>;
  /** Pull recent trips from the vendor (vendor sent them, we ingest). */
  pullTrips(cfg: IntegrationConfig, since?: string): Promise<ExternalTrip[]>;
  /** Verify an inbound webhook signature. Return true if valid. */
  verifyWebhook(rawBody: string, signature: string | null, cfg: IntegrationConfig): Promise<boolean>;
  /** Map an inbound webhook payload to ExternalTrip[]. */
  parseWebhook(rawBody: string): ExternalTrip[];
}

import { hibambiAdapter } from "./hibambi";
import { routegenieAdapter } from "./routegenie";
import { duerideAdapter } from "./dueride";

export function getAdapter(vendor: Vendor): IntegrationAdapter {
  switch (vendor) {
    case "hibambi": return hibambiAdapter;
    case "routegenie": return routegenieAdapter;
    case "dueride": return duerideAdapter;
  }
}
