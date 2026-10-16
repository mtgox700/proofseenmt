"use client";

import { useEffect } from "react";

/*
 * Registers the service worker of the installable app (C20). Mounted by the connected-space layout only: the public
 * pages are served as raw HTML without script and never register it. `updateViaCache: "none"` makes the browser check
 * /sw.js on every visit, so a new version takes over at the next page load.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error: unknown) => {
      console.warn("service worker: registration failed", error instanceof Error ? error.name : error);
    });
  }, []);
  return null;
}
