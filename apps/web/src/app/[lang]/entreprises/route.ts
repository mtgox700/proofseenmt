import { companyDirectory, getDb } from "@proofseen/db";
import { renderCompanyDirectory } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";
import { companyDirectoryQuery, companySearch } from "@/lib/company-directory-filters";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * Public directory of the companies that opened a public page (C16), and only them: moderated or suspended companies,
 * and those without an active member, never appear. Raw HTML from `@proofseen/hub`, no JavaScript, the same for every
 * visitor and crawler; a GET filter form (city, company type, hiring now, active SIRET) with the count of each option.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

const SEARCH_RULE = { windowMs: 60_000, max: 60 };
const UNAVAILABLE = "L'annuaire des entreprises est momentanément indisponible.";

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (lang !== "fr" && lang !== "en") return html("introuvable", 404, "no-store");
  if (!hasDatabase()) return html(UNAVAILABLE, 503, "no-store");
  if (await throttled("companies-index", clientAddress(request) ?? "unknown", SEARCH_RULE, new Date())) {
    return html("Trop de demandes : réessayez dans une minute.", 429, "no-store");
  }
  const filters = companyDirectoryQuery(new URL(request.url).searchParams);
  try {
    const { items, hasMore, facets } = await companyDirectory(getDb()).page(companySearch(filters));
    const page = renderCompanyDirectory(items, { baseUrl: publicBaseUrl(request), lang, filters, facets, hasMore });
    return html(page, 200, "public, max-age=0, s-maxage=300, stale-while-revalidate=1800");
  } catch (error) {
    logError("company directory: not rendered", error);
    return html(UNAVAILABLE, 500, "no-store");
  }
}
