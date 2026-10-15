import { articles, getDb } from "@proofseen/db";
import { blogSitemap } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/** Sitemap of the editorial pages: blog indexes, barometers, and every published article with its last update. */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!hasDatabase()) return new Response("base non configurée", { status: 503 });
  try {
    const xml = blogSitemap(publicBaseUrl(request), await articles(getDb()).listPublished());
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=1800" } });
  } catch (error) {
    logError("blog sitemap: not built", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
