import { after } from "next/server";
import { getDb, postComments, postFeed } from "@proofseen/db";
import { renderPostPage } from "@proofseen/hub";
import { countedHeaders, signedInClerkId } from "@/data/audience";
import { countPostSightings } from "@/data/community";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";
import { hubNotFound, hubUnavailable } from "@/lib/hub-status";

/*
 * Public page of a community post (C22): a complete HTML document from `@proofseen/hub`, readable without JavaScript,
 * the same for everyone, bots included. Only public posts whose author is still public exist here; a members-only,
 * deleted, hidden or unknown post answers 404 alike. The view is counted after the response is sent.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string; readonly id: string }>;
}

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, id } = await context.params;
  if ((lang !== "fr" && lang !== "en") || !UUID.test(id)) return hubNotFound(request, lang, "public, max-age=300");
  if (!hasDatabase()) return hubUnavailable(request, lang, 503);
  try {
    const db = getDb();
    const [post, comments] = await Promise.all([postFeed(db).get(null, id), postComments(db).list(null, id)]);
    if (post === null || comments === null) return hubNotFound(request, lang, "public, max-age=60");
    const page = renderPostPage({ ...post, comments }, { baseUrl: publicBaseUrl(request), lang });
    const counted = countedHeaders(request.headers);
    after(async () => countPostSightings(counted, "view", [post.id], await signedInClerkId()));
    // Une publication supprimée, masquée ou effacée doit quitter un cache partagé en une minute, pas en une heure
    // (relecture sécurité C22, B3).
    return html(page, 200, "public, max-age=0, s-maxage=60, stale-while-revalidate=60");
  } catch (error) {
    logError("post page: not rendered", error);
    return hubUnavailable(request, lang, 500);
  }
}
