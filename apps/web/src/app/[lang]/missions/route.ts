import { cityPages, getDb, missions, MissionSearchSchema } from "@proofseen/db";
import { renderJobIndex } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";
import { missionQuery } from "@/lib/mission-filters";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * Public index of open missions with a GET filter form: works without JavaScript, every search has its own address.
 * Keywords (full text, French and English), day rate, duration, publication date, city, work mode; the order is the one
 * the visitor picks, stated on the page. Anything malformed falls back to the plain list rather than an error page.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

const SEARCH_RULE = { windowMs: 60_000, max: 60 };

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (lang !== "fr" && lang !== "en") return html("introuvable", 404, "no-store");
  if (!hasDatabase()) return html("Les missions sont momentanément indisponibles.", 503, "no-store");
  if (await throttled("missions-index", clientAddress(request) ?? "unknown", SEARCH_RULE, new Date())) {
    return html("Trop de demandes : réessayez dans une minute.", 429, "no-store");
  }
  const url = new URL(request.url);
  const { filters, search } = missionQuery(url.searchParams, new Date());
  try {
    const db = getDb();
    const plain = url.search === "";
    const [{ items, hasMore }, cities] = await Promise.all([
      missions(db).search(MissionSearchSchema.parse(search)),
      // The city pages are linked from the plain list only: a filtered page is not indexed anyway.
      plain ? cityPages(db).listForSitemap() : Promise.resolve([]),
    ]);
    const published = items.flatMap((m) => (m.publishedAt === null ? [] : [{ ...m, publishedAt: m.publishedAt }]));
    const page = renderJobIndex(published, { baseUrl: publicBaseUrl(request), lang, filters, hasMore, cities });
    return html(page, 200, "public, max-age=0, s-maxage=120, stale-while-revalidate=600");
  } catch (error) {
    logError("missions index: not rendered", error);
    return html("Les missions sont momentanément indisponibles.", 500, "no-store");
  }
}
