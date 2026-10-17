import { parseSimulatorQuery, renderSimulatorPage } from "@proofseen/hub";
import { publicBaseUrl } from "@/lib/public-url";

/*
 * Net income simulator for freelancers: a plain GET form, raw HTML from `@proofseen/hub`, no JavaScript and no
 * database. Every rate comes from the dated, sourced constants of the hub package. The bare page (with a computed
 * example) is the indexed one; a page with a query renders the requested simulation and points back to it.
 */

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ readonly lang: string }>;
}

const html = (body: string, status: number, cache: string): Response =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache } });

export async function GET(request: Request, context: Context): Promise<Response> {
  const { lang } = await context.params;
  if (lang !== "fr" && lang !== "en") return html("introuvable", 404, "no-store");
  const query = parseSimulatorQuery(new URL(request.url).searchParams);
  const body = renderSimulatorPage({ baseUrl: publicBaseUrl(request), lang, query });
  return html(body, 200, query.kind === "empty" ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" : "public, max-age=300");
}
