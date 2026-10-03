import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://myfloridanemt.com";
// Indexable public pages only. /book and /join are noindex and excluded.
const paths = ["/", "/services", "/how-it-works", "/for-providers", "/for-facilities", "/florida-coverage", "/resources", "/frequently-asked-questions", "/shop", "/shop/hipaa", "/shop/nemt-certification", "/privacy", "/terms", "/accessibility", "/sitemap"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = paths
          .map((p) => `  <url>\n    <loc>${BASE_URL}${p}</loc>\n  </url>`)
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
