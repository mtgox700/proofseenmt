import { getDb, jobTitlePages } from "@proofseen/db";
import { renderJobTitlePage } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { safeDecode } from "@/lib/safe-decode";
import { logError } from "@/lib/log";

/*
 * Public page of one job title (a curated family of mission titles and profile headlines): its open missions and
 * published profiles. A title without enough real content answers 404 — never an empty page generated for search
 * engines.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string; readonly key: string }>;
}

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

const NOT_FOUND = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Poste introuvable</title><p>Pas encore assez de missions ni de profils pour ce poste.</p></html>';

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, key } = await context.params;
  if (lang !== "fr" && lang !== "en") return html(NOT_FOUND, 404, "no-store");
  // A malformed escape is an address that does not exist, not a server error.
  const decoded = safeDecode(key);
  if (decoded === null) return html(NOT_FOUND, 404, "public, max-age=300");
  if (!hasDatabase()) return html(NOT_FOUND, 503, "no-store");
  try {
    const page = await jobTitlePages(getDb()).page(decoded);
    if (page === null) return html(NOT_FOUND, 404, "public, max-age=300");
    return html(renderJobTitlePage(page, { baseUrl: publicBaseUrl(request), lang }), 200, "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  } catch (error) {
    logError("job title page: not rendered", error);
    return html(NOT_FOUND, 500, "no-store");
  }
}
