// Relative import: this module is imported by a vitest test, which does not resolve the "@/" alias.
import { notFoundPage, statusLang, unavailablePage } from "@proofseen/hub";
import { publicBaseUrl } from "./public-url";

/*
 * What a route of the hub answers when it has no page to show (Kensa review, B2): the brand's 404 or the brand's
 * incident page, in the language of the address (French when the segment is neither), never the bare 147-byte
 * document it used to send. The status is the route's: 404 for an address that leads nowhere, 503 without a database,
 * 500 when the page failed. Same HTML for every visitor and every robot.
 */

const HTML = "text/html; charset=utf-8";

export const hubNotFound = (request: Request, lang: string, cache: string): Response =>
  new Response(notFoundPage(statusLang(lang), { baseUrl: publicBaseUrl(request) }), { status: 404, headers: { "content-type": HTML, "cache-control": cache } });

export const hubUnavailable = (request: Request, lang: string, status: 500 | 503): Response =>
  new Response(unavailablePage(statusLang(lang), new URL(request.url).pathname, { baseUrl: publicBaseUrl(request) }), {
    status,
    headers: { "content-type": HTML, "cache-control": "no-store" },
  });
