import { offlinePage } from "@/lib/pwa/offline-page";

/*
 * /offline: the page the service worker of the connected space shows without network (C20). Static, in French and
 * English, without script; the service worker keeps a copy at install.
 */

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(offlinePage(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-robots-tag": "noindex",
    },
  });
}
