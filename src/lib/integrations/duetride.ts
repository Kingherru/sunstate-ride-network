/**
 * DuetRide adapter — STUB.
 *
 * Fill in real endpoint URLs, auth header format, and webhook signature
 * scheme once DuetRide sandbox credentials are obtained.
 */
import type { IntegrationAdapter } from "./adapter";

export const duetrideAdapter: IntegrationAdapter = {
  vendor: "duetride" as any,
  async pushTrip(_trip, _cfg) {
    throw new Error("DuetRide push: integration not yet configured. Provide API credentials in Integrations → DuetRide.");
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
