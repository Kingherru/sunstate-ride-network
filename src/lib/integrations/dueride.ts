/**
 * DueRide adapter — STUB.
 *
 * Fill in real endpoint URLs, auth header format, and webhook signature
 * scheme once DueRide sandbox credentials are obtained.
 */
import type { IntegrationAdapter } from "./adapter";

export const duerideAdapter: IntegrationAdapter = {
  vendor: "dueride" as any,
  async pushTrip(_trip, _cfg) {
    throw new Error("DueRide push: integration not yet configured. Provide API credentials in Integrations → DueRide.");
  },
  async pullTrips(_cfg, _since) {
    return [];
  },
  async verifyWebhook(_rawBody, _signature, _cfg) {
    return false;
  },
  parseWebhook(_rawBody) {
    return [];
  },
};
