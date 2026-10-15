import { articles, getDb } from "@proofseen/db";
import { blogFeed } from "@proofseen/hub";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

/** RSS 2.0 feed of the published articles of one language, newest first. */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (lang !== "fr" && lang !== "en") return new Response("introuvable", { status: 404 });
  if (!hasDatabase()) return new Response("base non configurée", { status: 503 });
  try {
    const xml = blogFeed(publicBaseUrl(request), lang, await articles(getDb()).feed(lang), new Date());
    return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600" } });
  } catch (error) {
    logError("blog feed: not built", error);
    return new Response("erreur serveur", { status: 500 });
  }
}
