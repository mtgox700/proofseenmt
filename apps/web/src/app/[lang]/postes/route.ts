import { getDb, jobTitlePages } from "@proofseen/db";
import { renderJobTitleIndex } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * Index of the job-title pages that exist (enough real missions and profiles to fill them), in alphabetical order. Raw
 * HTML from `@proofseen/hub`, like the job-title pages themselves: no JavaScript, same content for every crawler.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

const UNAVAILABLE = "Les pages par poste sont momentanément indisponibles.";

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (lang !== "fr" && lang !== "en") return html("introuvable", 404, "no-store");
  if (!hasDatabase()) return html(UNAVAILABLE, 503, "no-store");
  try {
    const entries = await jobTitlePages(getDb()).listForSitemap();
    return html(renderJobTitleIndex(entries, { baseUrl: publicBaseUrl(request), lang }), 200, "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  } catch (error) {
    logError("job title index: not rendered", error);
    return html(UNAVAILABLE, 500, "no-store");
  }
}
