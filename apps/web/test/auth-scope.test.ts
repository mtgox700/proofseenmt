import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { signInPath } from "../src/lib/sign-in-path";

/*
 * Kensa B3: Clerk on the home page cost a third of its HTML (its localisation in the RSC payload) and two scripts of
 * 130 kB. Clerk now wraps only the pages that use it: the connected space, sign-in and sign-up. The home page and the
 * public pages load none of it (STORYBOARD_V2 §8, « Jamais sur la landing : Clerk »).
 */

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const rel = (path: string): string => relative(src, path).replace(/\\/g, "/");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
const code = filesUnder(src).filter((f) => /\.tsx?$/.test(f));

describe("Clerk wraps only the pages that use it (Kensa B3)", () => {
  it("is not in the root layout of the [lang] segment", () => {
    // Code only: the layout's comment may name what it no longer mounts.
    const layout = readFileSync(join(src, "app", "[lang]", "layout.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(layout).not.toMatch(/AuthProvider|@clerk\//);
  });

  it("is mounted by the connected space, sign-in and sign-up, and nowhere else", () => {
    const providers = code.filter((f) => /<AuthProvider\b/.test(readFileSync(f, "utf8"))).map(rel);
    expect(providers.sort()).toEqual(["app/[lang]/app/layout.tsx", "app/[lang]/connexion/[[...rest]]/page.tsx", "app/[lang]/creer-un-compte/[[...rest]]/page.tsx"]);
  });

  it("keeps Clerk's browser components inside those pages", () => {
    const browser = code.filter((f) => /from "@clerk\/nextjs"/.test(readFileSync(f, "utf8"))).map(rel);
    for (const file of browser) {
      expect(file, file).toMatch(/^(?:app\/\[lang\]\/(?:app|connexion|creer-un-compte)\/|components\/(?:app\/AppShell|auth\/AuthProvider)\.tsx$)/);
    }
  });

  it("is not run by the middleware on the home page: it reads no session, and a handshake would delay its first byte", () => {
    const middleware = readFileSync(join(src, "middleware.ts"), "utf8");
    const home = /const HOME = (\/.*\/);/.exec(middleware)?.[1] ?? "";
    expect(home).not.toBe("");
    const pattern = new RegExp(home.slice(1, -1));
    for (const path of ["/fr", "/en", "/fr/"]) expect(pattern.test(path), path).toBe(true);
    for (const path of ["/fr/app", "/fr/connexion", "/en/missions", "/fr/creer-un-compte"]) expect(pattern.test(path), path).toBe(false);
    expect(middleware).toMatch(/authConfigured\(\) && !HOME\.test\(request\.nextUrl\.pathname\)/);
  });

  it("is never prefetched from the public header: plain links to sign-in and sign-up", () => {
    const header = readFileSync(join(src, "components", "SiteHeader.tsx"), "utf8");
    expect(header).not.toMatch(/<Link[^>]*href=\{menu\.sign(?:In|Up)\.href\}/);
  });
});

describe("sign-in brings the visitor back to the page that asked for it (Kensa M6)", () => {
  it("adds the path of this site to come back to", () => {
    expect(signInPath("fr", "/fr/app/missions/nouvelle")).toBe("/fr/connexion?redirect_url=%2Ffr%2Fapp%2Fmissions%2Fnouvelle");
    expect(signInPath("en")).toBe("/en/connexion");
  });

  it("refuses any address that is not a path of this site", () => {
    for (const evil of ["https://evil.example/fr", "//evil.example", "/fr/app?x=https://evil.example", "javascript:alert(1)", "/de/app"]) {
      expect(signInPath("fr", evil), evil).toBe("/fr/connexion");
    }
  });
});
