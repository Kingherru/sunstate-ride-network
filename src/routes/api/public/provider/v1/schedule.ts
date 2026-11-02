import { createFileRoute } from "@tanstack/react-router";
import { API_VERSION, authenticate, loadSchedule, parseRange } from "@/lib/provider-api.server";

export const Route = createFileRoute("/api/public/provider/v1/schedule")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request, "schedule:read", "v1/schedule");
        if (auth instanceof Response) return auth;
        const r = parseRange(new URL(request.url));
        if (!r) return Response.json({ version: API_VERSION, error: "invalid_request" }, { status: 400 });
        const { items, total } = await loadSchedule(auth, r);
        return Response.json({ version: API_VERSION, start: r.start, end: r.end, page: r.page, page_size: r.page_size, total, items }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
