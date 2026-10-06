import { getDb, missions, MissionSearchSchema, SEARCH_SORTS, type SearchSort } from "@proofseen/db";
import { renderJobIndex, type JobIndexFilters } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";
import { publicBaseUrl } from "@/lib/public-url";

/*
 * Public index of open missions with a GET filter form: works without JavaScript, every search has its own address.
 * Same filters and same validation as `GET /api/missions`; anything malformed falls back to the plain list rather
 * than an error page.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

const SEARCH_RULE = { windowMs: 60_000, max: 60 };
const MODES = new Set(["onsite", "hybrid", "remote"]);

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

const filtersFrom = (params: URLSearchParams): JobIndexFilters => {
  const sort = params.get("tri") ?? "";
  const page = Number(params.get("page") ?? "1");
  return {
    mode: params.getAll("mode").filter((m) => MODES.has(m)),
    skill: (params.get("competence") ?? "").trim().slice(0, 60),
    city: (params.get("ville") ?? "").trim().slice(0, 120),
    sort: (SEARCH_SORTS as readonly string[]).includes(sort) ? (sort as SearchSort) : "recent",
    page: Number.isInteger(page) && page >= 1 && page <= 50 ? page : 1,
  };
};

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (lang !== "fr" && lang !== "en") return html("introuvable", 404, "no-store");
  if (!hasDatabase()) return html("Les missions sont momentanément indisponibles.", 503, "no-store");
  if (await throttled("missions-index", clientAddress(request) ?? "unknown", SEARCH_RULE, new Date())) {
    return html("Trop de demandes : réessayez dans une minute.", 429, "no-store");
  }
  const filters = filtersFrom(new URL(request.url).searchParams);
  try {
    const search = MissionSearchSchema.parse({
      workModes: filters.mode,
      city: filters.city === "" ? undefined : filters.city,
      skills: filters.skill === "" ? [] : [filters.skill],
      sort: filters.sort,
      page: filters.page,
    });
    const { items, hasMore } = await missions(getDb()).search(search);
    const published = items.flatMap((m) => (m.publishedAt === null ? [] : [{ ...m, publishedAt: m.publishedAt }]));
    const page = renderJobIndex(published, { baseUrl: publicBaseUrl(request), lang, filters, hasMore });
    return html(page, 200, "public, max-age=0, s-maxage=120, stale-while-revalidate=600");
  } catch (error) {
    console.error("missions index: not rendered", error instanceof Error ? error.name : "unknown");
    return html("Les missions sont momentanément indisponibles.", 500, "no-store");
  }
}
