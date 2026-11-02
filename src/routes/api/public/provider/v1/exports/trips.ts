import { createFileRoute } from "@tanstack/react-router";
import { API_VERSION, authenticate, loadSchedule, parseRange, toCsv } from "@/lib/provider-api.server";

export const Route = createFileRoute("/api/public/provider/v1/exports/trips")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request, "exports:read", "v1/exports/trips");
        if (auth instanceof Response) return auth;
        const r = parseRange(new URL(request.url));
        if (!r) return Response.json({ version: API_VERSION, error: "invalid_request" }, { status: 400 });
        const { items, total } = await loadSchedule(auth, r);
        return new Response(toCsv(items), { headers: {
          "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="trips-${r.start}-${r.end}-p${r.page}.csv"`,
          "X-MFN-API-Version": API_VERSION, "X-Total-Count": String(total),
        } });
      },
    },
  },
});
