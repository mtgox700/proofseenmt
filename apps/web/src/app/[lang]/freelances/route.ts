import { after } from "next/server";
import { getDb, publicProfiles } from "@proofseen/db";
import { renderProfileDirectory } from "@proofseen/hub";
import { countDirectoryAppearances } from "@/data/audience";
import { hasDatabase } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";
import { directoryQuery } from "@/lib/directory-filters";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * Public directory of published freelancer profiles, with a GET filter form (skill, city): raw HTML from
 * `@proofseen/hub`, no JavaScript, every search at its own address. Most recently updated first — an order stated on
 * the page, never a score or a ranking of people.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

const SEARCH_RULE = { windowMs: 60_000, max: 60 };
const UNAVAILABLE = "L'annuaire des freelances est momentanément indisponible.";

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (lang !== "fr" && lang !== "en") return html("introuvable", 404, "no-store");
  if (!hasDatabase()) return html(UNAVAILABLE, 503, "no-store");
  if (await throttled("freelances-index", clientAddress(request) ?? "unknown", SEARCH_RULE, new Date())) {
    return html("Trop de demandes : réessayez dans une minute.", 429, "no-store");
  }
  const filters = directoryQuery(new URL(request.url).searchParams);
  try {
    const { items, hasMore } = await publicProfiles(getDb()).directory(filters);
    const page = renderProfileDirectory(items, { baseUrl: publicBaseUrl(request), lang, filters, hasMore });
    // Counted once the page is sent: what the directory shows never depends on it.
    after(() => countDirectoryAppearances(request.headers, items.map((item) => item.reference)));
    return html(page, 200, "public, max-age=0, s-maxage=120, stale-while-revalidate=600");
  } catch (error) {
    logError("freelancer directory: not rendered", error);
    return html(UNAVAILABLE, 500, "no-store");
  }
}
