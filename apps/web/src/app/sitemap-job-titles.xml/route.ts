import { getDb, jobTitlePages } from "@proofseen/db";
import { jobTitleSitemap } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/** Sitemap of the job-title pages that have enough real content to exist. */

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!hasDatabase()) return new Response("base non configurée", { status: 503 });
  try {
    const xml = jobTitleSitemap(publicBaseUrl(request), await jobTitlePages(getDb()).listForSitemap());
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=1800" } });
  } catch (error) {
    logError("job titles sitemap: not built", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
