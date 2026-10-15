import { articles, getDb } from "@proofseen/db";
import { renderBlogIndex } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { clientAddress, throttled } from "@/data/throttle";
import { blogQuery } from "@/lib/blog-query";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * Public blog index: the published articles of one language, newest first, filtered by category and audience with
 * plain links. Raw HTML from `@proofseen/hub`: no JavaScript, same content for every crawler.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

const RULE = { windowMs: 60_000, max: 120 };
const UNAVAILABLE = "Le blog est momentanément indisponible.";

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (lang !== "fr" && lang !== "en") return html("introuvable", 404, "no-store");
  if (!hasDatabase()) return html(UNAVAILABLE, 503, "no-store");
  if (await throttled("blog-index", clientAddress(request) ?? "unknown", RULE, new Date())) {
    return html("Trop de demandes : réessayez dans une minute.", 429, "no-store");
  }
  const filters = blogQuery(new URL(request.url).searchParams);
  try {
    const { items, hasMore } = await articles(getDb()).page({ lang, ...filters });
    return html(renderBlogIndex(items, { baseUrl: publicBaseUrl(request), lang, filters, hasMore }), 200, "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  } catch (error) {
    logError("blog index: not rendered", error);
    return html(UNAVAILABLE, 500, "no-store");
  }
}
