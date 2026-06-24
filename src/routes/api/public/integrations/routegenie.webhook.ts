import { createFileRoute } from "@tanstack/react-router";

/**
 * Inbound webhook from RouteGenie.
 * STUB: returns 501 until vendor signature scheme + payload format is wired.
 */
export const Route = createFileRoute("/api/public/integrations/routegenie/webhook")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "RouteGenie inbound webhook is not yet configured. Provide vendor signature scheme + payload spec to enable.",
          }),
          { status: 501, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
