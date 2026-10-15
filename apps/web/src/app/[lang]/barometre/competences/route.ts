import { renderSkillBarometer } from "@proofseen/hub";
import { BAROMETER_CACHE_CONTROL, skillBarometer } from "@/data/barometer-cache";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * Public barometer of the skills requested by recently published missions, with counts, nothing below the minimum.
 * Computed in the database at most once an hour (`@/data/barometer-cache`).
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

const UNAVAILABLE = "Le baromètre est momentanément indisponible.";

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (lang !== "fr" && lang !== "en") return html("introuvable", 404, "no-store");
  if (!hasDatabase()) return html(UNAVAILABLE, 503, "no-store");
  try {
    return html(renderSkillBarometer(await skillBarometer(), { baseUrl: publicBaseUrl(request), lang }), 200, BAROMETER_CACHE_CONTROL);
  } catch (error) {
    logError("skill barometer: not rendered", error);
    return html(UNAVAILABLE, 500, "no-store");
  }
}
