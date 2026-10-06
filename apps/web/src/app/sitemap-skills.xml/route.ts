import { getDb, skillPages } from "@proofseen/db";
import { skillSitemap } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";

/** Sitemap of the skill pages that have enough real content to exist. */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!hasDatabase()) return new Response("base non configurée", { status: 503 });
  try {
    const xml = skillSitemap(publicBaseUrl(request), await skillPages(getDb()).listForSitemap());
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=1800" } });
  } catch (error) {
    console.error("skills sitemap: not built", error instanceof Error ? error.name : "unknown");
    return new Response("erreur serveur", { status: 500 });
  }
}
