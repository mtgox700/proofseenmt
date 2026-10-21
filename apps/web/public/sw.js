/* global self, caches, fetch, URL, Response */
/*
 * Service worker of the Proofseen connected space (C20). Registered from the connected-space layout only, never from a
 * public page; its scope is the whole site, but it only touches what is listed here and lets everything else go to
 * the network untouched (public pages, API calls, files, server actions, streams).
 *
 * - Pages of /fr/app and /en/app: network first, never cached (they are personal); without network, the offline page.
 * - Build assets under /_next/static (content-hashed, immutable): cache first, a bounded number kept.
 * - Push: shows the notification sent by the server (title, a generic sentence, a link inside the site), then opens
 *   or focuses the app on click.
 *
 * Bump VERSION to drop every cache of the previous version on activation.
 */

const VERSION = "proofseen-v3";
const SHELL_CACHE = VERSION + "-shell";
const STATIC_CACHE = VERSION + "-static";
const OFFLINE_URL = "/offline";
const ICON = "/brand/icon-192.png";
const BADGE = "/icons/badge-96.png";
const SHELL = [OFFLINE_URL, ICON, BADGE];
const STATIC_LIMIT = 300;
const APP_PATH = /^\/(fr|en)\/app(\/|$)/;
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("proofseen-") && !key.startsWith(VERSION + "-")).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** What to do with a request: "app-page", "static", or "none" (the browser handles it as if there were no worker). */
const strategy = (request) => {
  if (request.method !== "GET") return "none";
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return "none";
  }
  if (url.origin !== self.location.origin) return "none";
  if (request.mode === "navigate") return APP_PATH.test(url.pathname) ? "app-page" : "none";
  // A development server serves unhashed assets under the same path: never cache them there.
  if (url.pathname.startsWith("/_next/static/") && !LOCAL_HOSTS.includes(self.location.hostname)) return "static";
  return "none";
};

const appPage = async (request) => {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
};

const trim = async (cache) => {
  const keys = await cache.keys();
  const extra = keys.length - STATIC_LIMIT;
  for (const key of keys.slice(0, Math.max(0, extra))) await cache.delete(key);
};

const staticAsset = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const kind = strategy(event.request);
  if (kind === "app-page") event.respondWith(appPage(event.request));
  else if (kind === "static") event.respondWith(staticAsset(event.request));
});

/** A path inside this site, or the notification centre: a push can never send the person elsewhere. */
const safePath = (value, lang) => {
  const fallback = "/" + lang + "/app/notifications";
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search : fallback;
  } catch {
    return fallback;
  }
};

const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");

const json = (event) => {
  try {
    const value = event.data ? event.data.json() : null;
    return value !== null && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};

const readPush = (event) => {
  const raw = json(event);
  const lang = raw.lang === "en" ? "en" : "fr";
  return { title: text(raw.title, 80) || "Proofseen", body: text(raw.body, 200), url: safePath(raw.url, lang), tag: text(raw.tag, 80), lang };
};

self.addEventListener("push", (event) => {
  const push = readPush(event);
  const options = { body: push.body, icon: ICON, badge: BADGE, lang: push.lang, data: { url: push.url } };
  if (push.tag !== "") options.tag = push.tag;
  event.waitUntil(self.registration.showNotification(push.title, options));
});

const openApp = async (path) => {
  const target = new URL(path, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const mine = windows.find((client) => new URL(client.url).origin === self.location.origin);
  if (mine) {
    try {
      const focused = await mine.focus();
      await focused.navigate(target);
      return;
    } catch {
      // An uncontrolled window cannot be navigated by the worker: open a new one instead.
    }
  }
  await self.clients.openWindow(target);
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const lang = event.notification.lang === "en" ? "en" : "fr";
  event.waitUntil(openApp(safePath(data.url, lang)));
});

/* The push service renewed the subscription: hand the new one to the server, for the account signed in here. */
self.addEventListener("pushsubscriptionchange", (event) => {
  const renew = async () => {
    const key = event.oldSubscription && event.oldSubscription.options ? event.oldSubscription.options.applicationServerKey : null;
    const fresh = event.newSubscription || (key ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : null);
    if (!fresh) return;
    await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fresh.toJSON()),
    });
  };
  event.waitUntil(renew().catch(() => undefined));
});
