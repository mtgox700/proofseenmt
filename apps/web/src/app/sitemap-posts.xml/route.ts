import { getDb, postFeed } from "@proofseen/db";
import { postSitemap } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/** Sitemap of the public community posts (C22): public, live, not hidden, author still public; shares are left out. */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!hasDatabase()) return new Response("base non configurée", { status: 503 });
  try {
    const xml = postSitemap(publicBaseUrl(request), await postFeed(getDb()).listPublic());
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=1800" } });
  } catch (error) {
    logError("posts sitemap: not built", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
