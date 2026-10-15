import { articles, getDb } from "@proofseen/db";
import { renderArticlePage } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { ARTICLE_CACHE_CONTROL } from "@/lib/article-cache";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/*
 * Public page of one published article. A draft, an unpublished article or an article of the other language answers
 * 404, exactly like an address that never existed: the repository only ever reads published articles.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string; readonly slug: string }>;
}

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

const NOT_FOUND = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Article introuvable</title><p>Cet article n\'existe pas ou n\'est pas publié. <a href="/fr/blog">Retour au blog</a></p></html>';

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, slug } = await context.params;
  if (lang !== "fr" && lang !== "en") return html(NOT_FOUND, 404, "no-store");
  if (!hasDatabase()) return html(NOT_FOUND, 503, "no-store");
  try {
    const repo = articles(getDb());
    // Slugs are plain ASCII: a malformed escape is simply an address that does not exist.
    const article = await repo.bySlug(lang, /^[a-z0-9-]{1,120}$/.test(slug) ? slug : "");
    if (article === null) return html(NOT_FOUND, 404, "public, max-age=60");
    const related = await repo.related(article);
    return html(renderArticlePage(article, related, { baseUrl: publicBaseUrl(request) }), 200, ARTICLE_CACHE_CONTROL);
  } catch (error) {
    logError("blog article: not rendered", error);
    return html(NOT_FOUND, 500, "no-store");
  }
}
