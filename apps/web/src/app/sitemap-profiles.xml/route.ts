import { getDb, publicProfiles } from "@proofseen/db";
import { profileSitemap } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/** Sitemap of the published freelancer profiles, in both languages. */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!hasDatabase()) return new Response("base non configurée", { status: 503 });
  try {
    const xml = profileSitemap(publicBaseUrl(request), await publicProfiles(getDb()).listForSitemap());
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=900" } });
  } catch (error) {
    logError("profiles sitemap: not built", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
