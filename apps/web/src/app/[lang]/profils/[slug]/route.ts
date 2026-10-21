import { after } from "next/server";
import { getDb, postFeed, publicProfiles } from "@proofseen/db";
import { renderProfilePage } from "@proofseen/hub";
import { countProfileView } from "@/data/audience";
import { hasDatabase } from "@/data/intake-sink";
import { nearbyProfilesFor } from "@/data/nearby";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";
import { hubNotFound, hubUnavailable } from "@/lib/hub-status";

/*
 * Public page of a freelancer profile: a complete HTML document readable without JavaScript, with ProfilePage data.
 * A private, withdrawn or unknown profile answers 404, so engines drop it. Contact always goes through the platform.
 * The view is counted after the response is sent (`after`): the page is the same for everyone, bots included.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string; readonly slug: string }>;
}

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, slug } = await context.params;
  if (lang !== "fr" && lang !== "en") return hubNotFound(request, lang, "no-store");
  if (!hasDatabase()) return hubUnavailable(request, lang, 503);
  try {
    const profile = await publicProfiles(getDb()).page(slug);
    if (profile === null) return hubNotFound(request, lang, "public, max-age=60");
    const posts = await postFeed(getDb()).recentFor({ reference: profile.reference });
    const page = renderProfilePage({ ...profile, posts }, { baseUrl: publicBaseUrl(request), lang, contactHref: `/${lang}/app/contact/${profile.reference}`, nearby: await nearbyProfilesFor(profile.slug, lang) });
    after(() => countProfileView(request.headers, profile.reference));
    return html(page, 200, "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  } catch (error) {
    logError("profile page: not rendered", error);
    return hubUnavailable(request, lang, 500);
  }
}
