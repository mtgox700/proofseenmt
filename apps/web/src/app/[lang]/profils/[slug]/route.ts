import { after } from "next/server";
import { getDb, publicProfiles } from "@proofseen/db";
import { renderProfilePage } from "@proofseen/hub";
import { countProfileView } from "@/data/audience";
import { hasDatabase } from "@/data/intake-sink";
import { publicBaseUrl } from "@/lib/public-url";
import { logError } from "@/lib/log";

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

const NOT_FOUND = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Profil introuvable</title><p>Ce profil n’existe pas ou n’est pas public.</p></html>';
const UNAVAILABLE = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Indisponible</title><p>Les profils sont momentanément indisponibles.</p></html>';

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang, slug } = await context.params;
  if (lang !== "fr" && lang !== "en") return html(NOT_FOUND, 404, "no-store");
  if (!hasDatabase()) return html(UNAVAILABLE, 503, "no-store");
  try {
    const profile = await publicProfiles(getDb()).page(slug);
    if (profile === null) return html(NOT_FOUND, 404, "public, max-age=60");
    const page = renderProfilePage(profile, { baseUrl: publicBaseUrl(request), lang, contactHref: `/${lang}/app/contact/${profile.reference}` });
    after(() => countProfileView(request.headers, profile.reference));
    return html(page, 200, "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  } catch (error) {
    logError("profile page: not rendered", error);
    return html(UNAVAILABLE, 500, "no-store");
  }
}
