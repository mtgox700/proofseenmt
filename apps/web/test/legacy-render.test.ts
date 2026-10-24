import { withoutHeaderSwitch } from "@proofseen/brand";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProfilesSite, PublicProfileSchema } from "@proofseen/profiles";
import { describe, expect, it } from "vitest";

/*
 * Kensa review, B3: the pages kept from the former static site (served from public/legacy at their indexed addresses)
 * were still in the old brand, with dashes, and the method page said things the product does not do. They are now
 * rendered by @proofseen/profiles in the marketplace's brand. These tests hold the saved files to the renderer, so a
 * change of the renderer that is not saved again fails here, and hold every served page to the brand's rules.
 */

const legacy = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "legacy");
const read = (path: string): string => readFileSync(join(legacy, path), "utf8");
const PAGES = [
  "contact/index.html",
  "methode/index.html",
  "n/ayoub-hammoudi/index.html",
  "en/contact/index.html",
  "en/method/index.html",
  "en/n/ayoub-hammoudi/index.html",
];

const rendered = (): ReadonlyMap<string, string> => {
  const api = JSON.parse(read("api/profiles.json")) as { profiles: Record<string, unknown>[] };
  const profiles = api.profiles.map(({ url: _url, ...p }) => PublicProfileSchema.parse(p));
  const files = buildProfilesSite(profiles, {
    baseUrl: "https://proofseen.com",
    namedArm: {
      profileId: "FR-7H2XK",
      identity: {
        displayName: "Ayoub Hammoudi",
        slug: "ayoub-hammoudi",
        sameAs: ["https://github.com/Ayoubhm07", "https://www.linkedin.com/in/ayoub-hammoudi-3251851b8", "https://ayoubdevspace.vercel.app"],
      },
    },
  });
  return new Map(files.map((f) => [f.path, f.content]));
};

describe("the pages kept from the former static site", () => {
  const fresh = rendered();

  it.each(PAGES)("%s is exactly what the renderer gives today", (path) => {
    expect(read(path)).toBe(fresh.get(path));
  });

  it.each(PAGES)("%s wears the brand, ships no script but JSON-LD, and carries no em dash", (path) => {
    const html = read(path);
    expect(html).toContain('<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">');
    expect(html).toContain('<header class="top has-sheet">');
    expect(html).toContain('<footer class="foot">');
    expect(html).not.toMatch(/#070b14|#3fcf9c/i);
    expect(html).not.toContain(String.fromCodePoint(0x2014));
    for (const [, attrs] of html.matchAll(/<script\b([^>]*)>/gi)) expect(attrs).toContain('type="application/ld+json"');
    expect(withoutHeaderSwitch(html)).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])/i);
  });

  it("no longer says that every mission was checked on a document, nor that a client's name is never published", () => {
    for (const path of ["methode/index.html", "en/method/index.html"]) {
      const html = read(path).replace(/&#39;/g, "'");
      expect(html).not.toMatch(/a été contrôlée sur au moins une pièce|was checked against at least one document/);
      expect(html).not.toMatch(/Son nom n'est jamais publié|The client's name is never published/);
    }
  });
});
