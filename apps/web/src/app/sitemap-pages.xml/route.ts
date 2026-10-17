import { publicBaseUrl } from "@/lib/public-url";

/**
 * The fixed pages: both home pages, the mission indexes, the freelancer directory, the skill and job-title indexes, the
 * net income simulator, and the pages kept from the former static site.
 */

const PATHS = ["/fr", "/en", "/fr/missions", "/en/missions", "/fr/freelances", "/en/freelances", "/fr/metiers", "/en/metiers", "/fr/postes", "/en/postes", "/fr/simulateur", "/en/simulateur", "/contact/", "/methode/", "/n/ayoub-hammoudi/", "/p/FR-7H2XK/", "/en/contact/", "/en/method/", "/en/n/ayoub-hammoudi/", "/en/p/FR-7H2XK/"] as const;

export function GET(request: Request): Response {
  const base = publicBaseUrl(request);
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...PATHS.map((path) => `<url><loc>${base}${path}</loc></url>`),
    `</urlset>`,
  ].join("\n");
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
