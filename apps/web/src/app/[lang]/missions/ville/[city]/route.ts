import { cityPages, getDb } from "@proofseen/db";
import { renderCityPage } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

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

const NOT_FOUND = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Ville introuvable</title><p>Pas encore assez de missions ouvertes dans cette ville.</p></html>';

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, city } = await context.params;
  if (lang !== "fr" && lang !== "en") return html(NOT_FOUND, 404, "no-store");
  if (!hasDatabase()) return html(NOT_FOUND, 503, "no-store");
  try {
    const page = await cityPages(getDb()).page(decodeURIComponent(city));
    if (page === null) return html(NOT_FOUND, 404, "public, max-age=300");
    return html(renderCityPage(page, { baseUrl: publicBaseUrl(request), lang }), 200, "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  } catch (error) {
    logError("city page: not rendered", error);
    return html(NOT_FOUND, 500, "no-store");
  }
}
