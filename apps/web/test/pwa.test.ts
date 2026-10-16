import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../next.config";
import { manifestPath, PWA_BACKGROUND, PWA_ICONS, webAppManifest } from "../src/lib/pwa/manifest";
import { OFFLINE_PATH, offlinePage } from "../src/lib/pwa/offline-page";

/*
 * The installable app (C20): the manifest, the offline page, the headers of the service worker, and the rule that
 * keeps all of it inside the connected space (public pages never link the manifest or register the worker).
 */

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = readFileSync(join(web, "src", "styles", "tokens.css"), "utf8");
const token = (name: string): string => new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i").exec(tokens)?.[1] ?? "absent";

/** Width and height of a PNG, from its IHDR chunk. */
const pngSize = (file: string): readonly [number, number] => {
  const bytes = readFileSync(file);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

describe("web app manifest", () => {
  it("opens the connected space in the person's language, standalone, over the whole site", () => {
    for (const lang of ["fr", "en"] as const) {
      const m = webAppManifest(lang);
      expect(m).toMatchObject({ id: "/app", name: "Proofseen", short_name: "Proofseen", lang, start_url: `/${lang}/app`, scope: "/", display: "standalone" });
      expect(m.shortcuts.map((s) => s.url)).toEqual([`/${lang}/app/messages`, `/${lang}/app/missions`, `/${lang}/app/notifications`]);
      expect(m.description.length).toBeGreaterThan(10);
      expect(manifestPath(lang)).toBe(`/${lang}/app.webmanifest`);
    }
    expect(webAppManifest("en").shortcuts.map((s) => s.name)).toEqual(["Messages", "Missions", "Notifications"]);
  });

  it("takes its colours from the design tokens", () => {
    expect(PWA_BACKGROUND).toBe(token("bg"));
    expect(webAppManifest("fr")).toMatchObject({ theme_color: token("bg"), background_color: token("bg") });
  });

  it("lists icons that exist, at the size they claim, with a maskable pair", () => {
    const m = webAppManifest("fr");
    expect(m.icons.filter((i) => i.purpose === "maskable").map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
    expect(m.icons.filter((i) => i.purpose === "any").map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
    for (const icon of [...m.icons, ...m.shortcuts.flatMap((s) => s.icons)]) {
      const [width, height] = pngSize(join(web, "public", icon.src));
      expect(`${width}x${height}`).toBe(icon.sizes);
    }
    expect(pngSize(join(web, "public", PWA_ICONS.badge))).toEqual([96, 96]);
    expect(pngSize(join(web, "src", "app", "[lang]", "app", "apple-icon.png"))).toEqual([180, 180]);
  });
});

describe("offline page", () => {
  it("stands alone: both languages, no script, no external resource, not indexed", () => {
    const html = offlinePage();
    expect(OFFLINE_PATH).toBe("/offline");
    expect(html).not.toMatch(/<script|<link|src=|@import|url\(/i);
    expect(html).toContain('<section lang="fr"><h1>Hors ligne</h1>');
    expect(html).toContain('<section lang="en"><h1>Offline</h1>');
    expect(html).toContain('href="/fr/app"');
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it("mirrors the colours of the design tokens", () => {
    const html = offlinePage();
    for (const name of ["bg", "surface", "ink", "muted", "line", "proof", "on-proof"]) expect(html).toContain(`--${name}:${token(name)}`);
  });
});

describe("service worker headers", () => {
  it("serves /sw.js with scope / allowed and revalidated on every visit", async () => {
    const rules = (await config.headers?.()) ?? [];
    const sw = rules.find((rule) => rule.source === "/sw.js");
    expect(sw?.headers).toEqual(expect.arrayContaining([{ key: "Service-Worker-Allowed", value: "/" }, { key: "Cache-Control", value: "no-cache" }]));
  });
});

const PWA_TRACES = /serviceWorker|sw\.js|webmanifest|manifestPath|ServiceWorkerRegistrar|PushToggle/;

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

describe("the installable app stays in the connected space", () => {
  const app = join(web, "src", "app");
  const connected = (path: string): boolean => {
    const rel = relative(app, path).replace(/\\/g, "/");
    return rel.startsWith("[lang]/app/") || rel.startsWith("[lang]/app.webmanifest/") || rel.startsWith("api/push/") || rel.startsWith("offline/");
  };

  it("is referenced by no public page, route or layout", () => {
    const outside = filesUnder(app).filter((path) => /\.(tsx?|js)$/.test(path) && !connected(path));
    expect(outside.length).toBeGreaterThan(20);
    for (const file of outside) expect(readFileSync(file, "utf8"), relative(web, file)).not.toMatch(PWA_TRACES);
  });

  it("has no root manifest file, which Next would link from every page", () => {
    for (const name of ["manifest.ts", "manifest.json", "manifest.webmanifest"]) expect(existsSync(join(app, name)), name).toBe(false);
    expect(existsSync(join(web, "public", "manifest.webmanifest"))).toBe(false);
  });

  it("is linked and registered by the connected-space layout", () => {
    const layout = readFileSync(join(app, "[lang]", "app", "layout.tsx"), "utf8");
    expect(layout).toContain("manifest: manifestPath(lang)");
    expect(layout).toContain("<ServiceWorkerRegistrar />");
  });
});
