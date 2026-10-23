import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ICONS, MONOGRAM_SMALL_PATH, PALETTE } from "@proofseen/brand";
import { describe, expect, it } from "vitest";
import config from "../next.config";
import { manifestPath, PWA_BACKGROUND, PWA_ICONS, webAppManifest } from "../src/lib/pwa/manifest";
import { OFFLINE_PATH, offlinePage } from "../src/lib/pwa/offline-page";

/*
 * The installable app (C20): the manifest, the offline page, the headers of the service worker, and the rule that
 * keeps all of it inside the connected space (public pages never link the manifest or register the worker).
 */

const web = join(dirname(fileURLToPath(import.meta.url)), "..");

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

  it("takes its colours from the brand palette (dark only)", () => {
    expect(PWA_BACKGROUND).toBe(PALETTE.dark.bg);
    expect(webAppManifest("fr")).toMatchObject({ theme_color: PALETTE.dark.bg, background_color: PALETTE.dark.bg });
  });

  it("lists icons that exist, at the size they claim, with a maskable pair", () => {
    const m = webAppManifest("fr");
    expect(m.icons.filter((i) => i.purpose === "maskable").map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
    expect(m.icons.filter((i) => i.purpose === "any").map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
    for (const icon of [...m.icons, ...m.shortcuts.flatMap((s) => s.icons)]) {
      const [width, height] = pngSize(join(web, "public", icon.src));
      expect(`${width}x${height}`).toBe(icon.sizes);
    }
    expect(m.icons.every((i) => i.src.startsWith("/brand/"))).toBe(true);
    expect(pngSize(join(web, "public", PWA_ICONS.badge))).toEqual([96, 96]);
    expect(pngSize(join(web, "public", ICONS.apple))).toEqual([180, 180]);
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

  it("writes the brand palette into the page, dark only, with one browser colour", () => {
    const html = offlinePage();
    for (const name of ["bg", "surface", "text", "muted", "line"] as const) expect(html).toContain(`--ps-${name}:${PALETTE.dark[name]};`);
    expect(html).toContain(`<meta name="theme-color" content="${PALETTE.dark.bg}">`);
    expect(html).toContain('<meta name="color-scheme" content="dark">');
    expect(html).not.toMatch(/prefers-color-scheme|color-scheme:\s*light|data-theme/);
    expect(html.match(/name="theme-color"/g)).toHaveLength(1);
    // The way back is paper on ink, like every call to action: green is kept for what is verified.
    expect(html).not.toContain(PALETTE.dark.proof);
  });

  it("carries the brand: the poinçon inline in its monochrome version, the trace, safe areas", () => {
    const html = offlinePage();
    expect(html).toContain(`fill="currentColor" fill-rule="evenodd" d="${MONOGRAM_SMALL_PATH}"`);
    expect(html).toContain('role="img" aria-label="Proofseen"');
    expect(html).toContain('<svg class="trace"');
    expect(html).toContain("env(safe-area-inset-bottom)");
    expect(html).toContain("@media (hover:hover) and (pointer:fine){a:hover");
    expect(html).not.toMatch(/—/);
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
