import { cityPages, getDb } from "@proofseen/db";
import { renderCityPage } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { safeDecode } from "@/lib/safe-decode";
import { logError } from "@/lib/log";
import { hubNotFound, hubUnavailable } from "@/lib/hub-status";

/*
 * Public page of one city: its open missions. A city with too few real missions answers 404 — never an empty page
 * generated for search engines. Served as a complete HTML document from `@proofseen/hub`, readable without JavaScript.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string; readonly city: string }>;
}

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, city } = await context.params;
  if (lang !== "fr" && lang !== "en") return hubNotFound(request, lang, "no-store");
  // A malformed escape is an address that does not exist, not a server error.
  const decoded = safeDecode(city);
  if (decoded === null) return hubNotFound(request, lang, "public, max-age=300");
  if (!hasDatabase()) return hubUnavailable(request, lang, 503);
  try {
    const page = await cityPages(getDb()).page(decoded);
    if (page === null) return hubNotFound(request, lang, "public, max-age=300");
    return html(renderCityPage(page, { baseUrl: publicBaseUrl(request), lang }), 200, "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  } catch (error) {
    logError("city page: not rendered", error);
    return hubUnavailable(request, lang, 500);
  }
}
