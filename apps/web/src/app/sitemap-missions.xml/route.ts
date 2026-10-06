import { getDb, missions } from "@proofseen/db";
import { jobSitemap } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/** Sitemap of the open missions, in both languages. Engines read it to find what to crawl; IndexNow says when. */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!hasDatabase()) return new Response("base non configurée", { status: 503 });
  try {
    const xml = jobSitemap(publicBaseUrl(request), await missions(getDb()).listOpenForSitemap());
    return new Response(xml, {
      headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=900" },
    });
  } catch (error) {
    logError("missions sitemap: not built", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
