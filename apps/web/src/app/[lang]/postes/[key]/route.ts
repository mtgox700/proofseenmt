import { getDb, jobTitlePages } from "@proofseen/db";
import { renderJobTitlePage } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { safeDecode } from "@/lib/safe-decode";
import { logError } from "@/lib/log";
import { hubNotFound, hubUnavailable } from "@/lib/hub-status";

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

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, key } = await context.params;
  if (lang !== "fr" && lang !== "en") return hubNotFound(request, lang, "no-store");
  // A malformed escape is an address that does not exist, not a server error.
  const decoded = safeDecode(key);
  if (decoded === null) return hubNotFound(request, lang, "public, max-age=300");
  if (!hasDatabase()) return hubUnavailable(request, lang, 503);
  try {
    const page = await jobTitlePages(getDb()).page(decoded);
    if (page === null) return hubNotFound(request, lang, "public, max-age=300");
    return html(renderJobTitlePage(page, { baseUrl: publicBaseUrl(request), lang }), 200, "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  } catch (error) {
    logError("job title page: not rendered", error);
    return hubUnavailable(request, lang, 500);
  }
}
