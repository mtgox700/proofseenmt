/*
 * The download of a version answers JSON when it fails (`introuvable`, `erreur serveur`): right for a script, raw text
 * for a person who clicked « Télécharger le PDF » (storyboard L1.6, §4 E4, T11). For a navigation of the browser, a
 * failed download goes back to the document's page with `?erreur=telechargement`, which says it in words. A successful
 * download, and any request that is not a navigation, is left exactly as the API answered it.
 */

const LANGS = new Set(["fr", "en"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMBER = /^[1-9][0-9]{0,5}$/;

/**
 * A person's browser opening the link as a page: a navigation whose destination is a document (L1-159 B4). Not a frame,
 * not a script fetching bytes. Old browsers without Fetch Metadata fall back on the Accept header.
 */
export function isNavigation(request: Request): boolean {
  const mode = request.headers.get("sec-fetch-mode");
  if (mode !== null) return mode === "navigate" && request.headers.get("sec-fetch-dest") === "document";
  return (request.headers.get("accept") ?? "").includes("text/html");
}

/** The language of the page the person came from; French otherwise, as the rest of the site. */
function langOf(request: Request): string {
  const referer = request.headers.get("referer");
  if (referer === null) return "fr";
  try {
    const first = new URL(referer).pathname.split("/")[1] ?? "";
    return LANGS.has(first) ? first : "fr";
  } catch {
    return "fr";
  }
}

export function downloadFallback(request: Request, response: Response, id: string, number: string): Response {
  if (response.status === 200 || !isNavigation(request) || !UUID.test(id)) return response;
  const version = NUMBER.test(number) ? `version=${number}&` : "";
  const target = new URL(`/${langOf(request)}/app/documents/${id}?${version}erreur=telechargement`, request.url);
  return new Response(null, { status: 303, headers: { location: target.pathname + target.search, "cache-control": "no-store" } });
}
