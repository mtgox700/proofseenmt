import { getDb, missions } from "@proofseen/db";
import { renderJobPage } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";

/*
 * Public page of an open mission: a complete HTML document from `@proofseen/hub`, readable without JavaScript, with its
 * `JobPosting` data. Served by a route handler rather than a React page on purpose: what a search or AI engine reads
 * here must not depend on any script running. A closed or unknown mission answers 404, so engines drop it.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string; readonly id: string }>;
}

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

const NOT_FOUND = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Mission introuvable</title><p>Cette mission n’existe pas ou n’est plus ouverte.</p></html>';
const UNAVAILABLE = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Indisponible</title><p>Les missions sont momentanément indisponibles.</p></html>';

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, id } = await context.params;
  if (lang !== "fr" && lang !== "en") return html(NOT_FOUND, 404, "no-store");
  if (!hasDatabase()) return html(UNAVAILABLE, 503, "no-store");
  try {
    const mission = await missions(getDb()).findPublic(id);
    if (mission === null || mission.publishedAt === null) return html(NOT_FOUND, 404, "public, max-age=60");
    const page = renderJobPage(
      { ...mission, publishedAt: mission.publishedAt },
      { baseUrl: publicBaseUrl(request), lang, applyHref: `/${lang}/creer-un-compte` },
    );
    // Five minutes at the edge: an edit or a closure shows within minutes, and a crawl burst does not reach the database.
    return html(page, 200, "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  } catch (error) {
    console.error("mission page: not rendered", error instanceof Error ? error.name : "unknown");
    return html(UNAVAILABLE, 500, "no-store");
  }
}
