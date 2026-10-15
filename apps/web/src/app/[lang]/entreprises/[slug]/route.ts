import { companyPages, getDb } from "@proofseen/db";
import { renderCompanyPage } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { safeDecode } from "@/lib/safe-decode";
import { logError } from "@/lib/log";

/*
 * Public page of a company that chose to have one. A company that did not opt in answers 404, exactly like an unknown
 * address: whether it exists on Proofseen is not revealed. Served as a complete HTML document from `@proofseen/hub`.
 * (`/[lang]/entreprise`, singular, is the old offer page that redirects to the freelancer directory.)
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string; readonly slug: string }>;
}

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

const NOT_FOUND = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Entreprise introuvable</title><p>Cette entreprise n’a pas de page publique.</p></html>';

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, slug } = await context.params;
  if (lang !== "fr" && lang !== "en") return html(NOT_FOUND, 404, "no-store");
  // A malformed escape is an address that does not exist, not a server error.
  const decoded = safeDecode(slug);
  if (decoded === null) return html(NOT_FOUND, 404, "public, max-age=300");
  if (!hasDatabase()) return html(NOT_FOUND, 503, "no-store");
  try {
    const page = await companyPages(getDb()).page(decoded);
    if (page === null) return html(NOT_FOUND, 404, "public, max-age=60");
    return html(renderCompanyPage(page, { baseUrl: publicBaseUrl(request), lang }), 200, "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  } catch (error) {
    logError("company page: not rendered", error);
    return html(NOT_FOUND, 500, "no-store");
  }
}
