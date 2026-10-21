import { getDb, missions } from "@proofseen/db";
import { renderJobPage } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { nearbyMissionsFor } from "@/data/nearby";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";
import { hubNotFound, hubUnavailable } from "@/lib/hub-status";

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

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, id } = await context.params;
  if (lang !== "fr" && lang !== "en") return hubNotFound(request, lang, "no-store");
  if (!hasDatabase()) return hubUnavailable(request, lang, 503);
  try {
    const mission = await missions(getDb()).findPublic(id);
    if (mission === null || mission.publishedAt === null) return hubNotFound(request, lang, "public, max-age=60");
    const page = renderJobPage(
      { ...mission, publishedAt: mission.publishedAt },
      { baseUrl: publicBaseUrl(request), lang, applyHref: `/${lang}/app/missions/${mission.id}/postuler`, nearby: await nearbyMissionsFor(mission.id, lang) },
    );
    // Five minutes at the edge: an edit or a closure shows within minutes, and a crawl burst does not reach the database.
    return html(page, 200, "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  } catch (error) {
    logError("mission page: not rendered", error);
    return hubUnavailable(request, lang, 500);
  }
}
