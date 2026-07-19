import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getAllSlugs } from "@/content/blog";

const BASE_URL = "https://myfloridanemt.com";

const staticPaths = [
  "/",
  "/services",
  "/services/ambulatory",
  "/services/wheelchair",
  "/services/stretcher",
  "/services/medical-deliveries",
  "/service-areas",
  "/service-areas/jacksonville",
  "/service-areas/orlando",
  "/service-areas/tampa",
  "/service-areas/miami",
  "/service-areas/tallahassee",
  "/service-areas/fort-lauderdale",
  "/providers",
  "/join-our-network",
  "/how-it-works",
  "/resources",
  "/training",
  "/membership",
  "/changelog",
  "/about",
  "/contact",
  "/request-a-ride",
  "/auth",
  "/reset-password",
  "/black-tie",
];

const paths = [
  ...staticPaths,
  ...getAllSlugs().map((slug) => `/resources/${slug}`),
];


export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = paths
          .map(
            (p) =>
              `  <url>\n    <loc>${BASE_URL}${p}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${p === "/" ? "1.0" : "0.8"}</priority>\n  </url>`
          )
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
