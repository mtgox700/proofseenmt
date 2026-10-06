import { indexNowKey } from "@/data/indexnow";

/** The IndexNow key file: proves to the engines that this host is the one notifying them. 404 while no key is set. */

export function GET(): Response {
  const key = indexNowKey();
  if (key === null) return new Response("introuvable", { status: 404 });
  return new Response(`${key}\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
