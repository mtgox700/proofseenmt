import { renderLegalPage, type LegalPage } from "@proofseen/hub";
import { publicBaseUrl } from "./public-url";

/*
 * The three legal pages: raw HTML from `@proofseen/hub`, no JavaScript and no database, the same for every visitor and
 * every robot. Relative imports only: the routes are imported by a vitest test, which does not resolve the "@/" alias.
 */

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

const CACHE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

export const legalRoute =
  (page: LegalPage) =>
  async (request: Request, context: Context): Promise<Response> => {
    const { lang } = await context.params;
    if (lang !== "fr" && lang !== "en") {
      return new Response("introuvable", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    }
    const body = renderLegalPage({ baseUrl: publicBaseUrl(request), lang, page });
    return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": CACHE } });
  };
