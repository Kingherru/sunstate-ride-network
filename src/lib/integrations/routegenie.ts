/**
 * RouteGenie adapter — STUB.
 *
 * Real endpoint URLs, auth header format, and webhook signature scheme are
 * not publicly documented. Once we obtain sandbox credentials and API docs,
 * fill in the TODOs below.
 */
import type { IntegrationAdapter } from "./adapter";

export const routegenieAdapter: IntegrationAdapter = {
  vendor: "routegenie",
  async pushTrip(_trip, _cfg) {
    throw new Error("RouteGenie push: integration not yet configured. Provide API credentials in Integrations → RouteGenie.");
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
