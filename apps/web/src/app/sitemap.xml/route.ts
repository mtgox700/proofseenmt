import { publicBaseUrl } from "@/lib/public-url";

/*
 * The sitemap index, at the address the former static site already declared: it points to the sitemap of the fixed
 * pages and to the three that are built from the database (missions, profiles, skill pages).
 */

const PARTS = ["sitemap-pages.xml", "sitemap-missions.xml", "sitemap-profiles.xml", "sitemap-skills.xml", "sitemap-blog.xml", "sitemap-companies.xml"] as const;

export function GET(request: Request): Response {
  const base = publicBaseUrl(request);
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...PARTS.map((part) => `<sitemap><loc>${base}/${part}</loc></sitemap>`),
    `</sitemapindex>`,
  ].join("\n");
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
