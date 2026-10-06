import { marketplaceRobots } from "@proofseen/hub";
import { publicBaseUrl } from "@/lib/public-url";

/*
 * robots.txt: every AI search crawler explicitly allowed (blocking OAI-SearchBot removes a site from ChatGPT search),
 * private areas kept out, both sitemaps declared.
 */

export function GET(request: Request): Response {
  return new Response(marketplaceRobots(publicBaseUrl(request)), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
