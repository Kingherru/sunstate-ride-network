/**
 * hiBambi adapter — STUB.
 *
 * Real endpoint URLs, auth header format, and webhook signature scheme are
 * not publicly documented. Once we obtain sandbox credentials and API docs,
 * fill in the TODOs below.
 */
import type { IntegrationAdapter } from "./adapter";

export const hibambiAdapter: IntegrationAdapter = {
  vendor: "hibambi",
  async pushTrip(_trip, _cfg) {
    throw new Error("hiBambi push: integration not yet configured. Provide API credentials in Integrations → hiBambi.");
  },
  async pullTrips(_cfg, _since) {
    return [];
  },
  async verifyWebhook(_rawBody, _signature, _cfg) {
    return false; // stub — always reject until real signature scheme is wired
  },
  parseWebhook(_rawBody) {
    return [];
  },
};
