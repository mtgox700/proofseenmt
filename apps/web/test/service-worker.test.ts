import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

/*
 * public/sw.js run as written, in a sandbox standing in for the browser: which requests it takes over (connected-space
 * pages, build assets) and which it leaves alone (public pages, API, files, server actions), what it shows without
 * network, what a push displays, where a click leads, and which caches an update drops.
 */

const SOURCE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sw.js"), "utf8");

type Handler = (event: Record<string, unknown>) => void;

interface FakeResponse {
  readonly ok: boolean;
  readonly type: string;
  readonly label: string;
  clone(): FakeResponse;
}

const response = (label: string): FakeResponse => ({ ok: true, type: "basic", label, clone: () => response(label) });

const boot = (origin = "https://proofseen.com", network: (url: string) => Promise<FakeResponse> = async (url) => response(`network:${url}`)) => {
  const handlers = new Map<string, Handler>();
  const stores = new Map<string, Map<string, FakeResponse>>([["proofseen-v0-static", new Map()], ["other-app", new Map()]]);
  const store = (name: string) => {
    const existing = stores.get(name);
    if (existing !== undefined) return existing;
    const created = new Map<string, FakeResponse>();
    stores.set(name, created);
    return created;
  };
  const key = (request: string | { url: string }) => (typeof request === "string" ? request : request.url);
  const caches = {
    open: async (name: string) => ({
      addAll: async (urls: string[]) => urls.forEach((url) => store(name).set(url, response(`cached:${url}`))),
      match: async (request: string | { url: string }) => store(name).get(key(request)),
      put: async (request: { url: string }, value: FakeResponse) => void store(name).set(request.url, value),
      keys: async () => [...store(name).keys()],
      delete: async (request: string) => store(name).delete(request),
    }),
    match: async (url: string) => [...stores.values()].map((s) => s.get(url)).find((hit) => hit !== undefined),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const opened: string[] = [];
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const self = {
    location: new URL(origin),
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined, matchAll: async () => [], openWindow: async (url: string) => void opened.push(url) },
    registration: { showNotification: async (title: string, options: Record<string, unknown>) => void shown.push({ title, options: JSON.parse(JSON.stringify(options)) as Record<string, unknown> }) },
  };
  const fetch = vi.fn((request: { url: string } | string) => network(key(request)));
  runInNewContext(SOURCE, { self, caches, fetch, URL, Response, console });
  const fire = async (type: string, event: Record<string, unknown>): Promise<unknown> => {
    let answered: Promise<unknown> | null = null;
    const waits: Promise<unknown>[] = [];
    handlers.get(type)?.({ ...event, respondWith: (p: Promise<unknown>) => (answered = p), waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    return answered === null ? "untouched" : await answered;
  };
  return { fire, fetch, stores, opened, shown };
};

const get = (url: string, mode = "cors", method = "GET") => ({ request: { url: `https://proofseen.com${url}`, mode, method } });

describe("requests the service worker takes over", () => {
  it("leaves public pages, the API, files, streams and form posts to the network", async () => {
    const sw = boot();
    for (const path of ["/fr", "/fr/profils/fr-abcde", "/en/missions/123", "/fr/metiers/rust", "/fr/blog/un-article", "/offline"]) {
      expect(await sw.fire("fetch", get(path, "navigate")), path).toBe("untouched");
    }
    for (const path of ["/api/messages/stream", "/api/push/subscribe", "/fichiers/0199", "/fr/app/messages", "/icons/icon-192.png", "/sitemap.xml"]) {
      expect(await sw.fire("fetch", get(path)), path).toBe("untouched");
    }
    // A server action is a POST navigation: never intercepted, never replayed.
    expect(await sw.fire("fetch", get("/fr/app/messages", "navigate", "POST"))).toBe("untouched");
    expect(await sw.fire("fetch", { request: { url: "https://cdn.example/_next/static/a.js", mode: "cors", method: "GET" } })).toBe("untouched");
  });

  it("serves connected-space pages from the network, never from a cache", async () => {
    const sw = boot();
    const page = (await sw.fire("fetch", get("/fr/app/messages", "navigate"))) as FakeResponse;
    expect(page.label).toBe("network:https://proofseen.com/fr/app/messages");
    for (const [, store] of sw.stores) expect([...store.keys()].some((url) => url.includes("/fr/app"))).toBe(false);
  });

  it("shows the offline page when a connected-space page cannot be reached", async () => {
    const sw = boot("https://proofseen.com", async () => {
      throw new TypeError("Failed to fetch");
    });
    await sw.fire("install", {});
    const page = (await sw.fire("fetch", get("/en/app", "navigate"))) as FakeResponse;
    expect(page.label).toBe("cached:/offline");
  });

  it("keeps build assets cache-first, but not on a development server", async () => {
    const sw = boot();
    const first = (await sw.fire("fetch", get("/_next/static/chunks/app-1a2b.js"))) as FakeResponse;
    const second = (await sw.fire("fetch", get("/_next/static/chunks/app-1a2b.js"))) as FakeResponse;
    expect(first.label).toBe(second.label);
    expect(sw.fetch).toHaveBeenCalledTimes(1);
    const dev = boot("http://localhost:3100");
    expect(await dev.fire("fetch", { request: { url: "http://localhost:3100/_next/static/chunks/app.js", mode: "cors", method: "GET" } })).toBe("untouched");
  });
});

describe("versions", () => {
  it("drops the caches of an older version on activation, and only those", async () => {
    const sw = boot();
    await sw.fire("install", {});
    await sw.fire("activate", {});
    expect([...sw.stores.keys()].sort()).toEqual(["other-app", "proofseen-v1-shell"]);
  });
});

describe("push", () => {
  const push = (data: unknown) => ({ data: { json: () => data } });

  it("shows the title and sentence sent by the server, with the app icon", async () => {
    const sw = boot();
    await sw.fire("push", push({ title: "Proofseen", body: "Nouveau message dans une conversation.", url: "/fr/app/messages/abc", tag: "thread-abc", lang: "fr" }));
    expect(sw.shown).toEqual([
      { title: "Proofseen", options: { body: "Nouveau message dans une conversation.", icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", lang: "fr", data: { url: "/fr/app/messages/abc" }, tag: "thread-abc" } },
    ]);
  });

  it("never links outside the site, and survives an unreadable payload", async () => {
    const sw = boot();
    await sw.fire("push", push({ title: "x", url: "https://evil.example/phish", lang: "en" }));
    await sw.fire("push", push({ url: "//evil.example/x" }));
    await sw.fire("push", { data: { json: () => JSON.parse("not json") as unknown } });
    await sw.fire("push", {});
    expect(sw.shown.map((n) => (n.options.data as { url: string }).url)).toEqual(["/en/app/notifications", "/fr/app/notifications", "/fr/app/notifications", "/fr/app/notifications"]);
    expect(sw.shown.slice(2).map((n) => n.title)).toEqual(["Proofseen", "Proofseen"]);
  });

  it("opens the linked page of the site on click", async () => {
    const sw = boot();
    const close = vi.fn();
    await sw.fire("notificationclick", { notification: { close, data: { url: "/fr/app/contrats/0199" }, lang: "fr" } });
    await sw.fire("notificationclick", { notification: { close, data: { url: "https://evil.example" }, lang: "en" } });
    expect(close).toHaveBeenCalledTimes(2);
    expect(sw.opened).toEqual(["https://proofseen.com/fr/app/contrats/0199", "https://proofseen.com/en/app/notifications"]);
  });
});
