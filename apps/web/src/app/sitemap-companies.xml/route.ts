import { companyPages, getDb } from "@proofseen/db";
import { companySitemap } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/** Sitemap of the company pages, only those the companies chose to publish. */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!hasDatabase()) return new Response("base non configurée", { status: 503 });
  try {
    const xml = companySitemap(publicBaseUrl(request), await companyPages(getDb()).listForSitemap());
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=1800" } });
  } catch (error) {
    logError("companies sitemap: not built", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
