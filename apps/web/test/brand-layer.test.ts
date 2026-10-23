import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio, FONT_FILES, PALETTE, SHARE_CARD } from "@proofseen/brand";
import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_ORIGIN, shareMetadata, siteOrigin } from "../src/lib/brand-metadata";

/*
 * Lot a of the redesign, on the React side: the brand tokens are the only source of colour, the old fonts are gone,
 * one display font is preloaded, the home page is indexable while the connected space and the private pages are not.
 */

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(web, "src");
const app = join(src, "app");
const brand = join(web, "..", "..", "packages", "brand");
const read = (...parts: string[]): string => readFileSync(join(...parts), "utf8");

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

const styles = readdirSync(join(src, "styles")).filter((f) => f.endsWith(".css"));

describe("colours come from the brand tokens only", () => {
  it.each(styles)("%s types no colour: no hex, no rgb(), no hsl(), no named colour", (file) => {
    const css = read(src, "styles", file).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|lab|lch)\(/i);
    expect(css).not.toMatch(/:\s*(?:white|black|red|green|blue|gray|grey)\b/i);
  });

  it.each(styles)("%s uses the brand names, not the variables of the former charter", (file) => {
    const css = read(src, "styles", file);
    const old = /var\(--(?:bg|bg-raised|surface|surface-hi|ink|muted|line|line-strong|proof|on-proof|proof-wash|signal|info|serif|sans|mono|step-[-\d]+|space-\d+|gutter|max|radius|ease-out|ease-in-out|dur-press|dur-ui|z-header|z-skip)[,)]/;
    expect(css).not.toMatch(old);
  });

  it.each(styles)("%s keeps hover where hover exists", (file) => {
    const css = read(src, "styles", file).replace(/\/\*[\s\S]*?\*\//g, "");
    // Walk the blocks: every rule whose selector holds :hover sits inside a (hover: hover) media query.
    const stack: string[] = [];
    let prelude = "";
    const bare: string[] = [];
    for (const char of css) {
      if (char === "{") {
        const head = prelude.trim();
        if (head.includes(":hover") && !stack.some((s) => /hover:\s*hover/.test(s))) bare.push(head);
        stack.push(head);
        prelude = "";
      } else if (char === "}") {
        stack.pop();
        prelude = "";
      } else if (char === ";") {
        prelude = "";
      } else {
        prelude += char;
      }
    }
    expect(bare).toEqual([]);
  });

  it("keeps the green off the call to action", () => {
    for (const file of styles) {
      const css = read(src, "styles", file);
      for (const rule of css.match(/[^{}]*\{[^}]*\}/g) ?? []) {
        if (/\.btn-primary|\.cta\b|button\[type="submit"\]/.test(rule.split("{")[0] ?? "")) expect(rule, file).not.toMatch(/background(?:-color)?:\s*var\(--ps-proof\)/);
      }
    }
  });
});

describe("the green marks a verified fact or the poinçon, nothing else (Kensa M5)", () => {
  // Every innermost block that reads --ps-proof (or --ps-proof-wash), named by its selector path. Reads, not
  // declarations: the brand's tokens.css declares the colour, and declaring it marks nothing.
  const greenRules = (css: string): string[] => {
    const found: string[] = [];
    const stack: string[] = [];
    let buffer = "";
    for (const char of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
      if (char === "{") {
        stack.push(buffer.trim().replace(/\s+/g, " "));
        buffer = "";
      } else if (char === "}") {
        if (/var\(--ps-proof/.test(buffer)) found.push(stack.join(" > "));
        stack.pop();
        buffer = "";
      } else {
        buffer += char;
      }
    }
    return found;
  };

  it("lets only the proof tag and the storefront's verified marks read the proof colour", () => {
    const green = styles.flatMap((file) => greenRules(read(src, "styles", file)).map((selector) => `${file}: ${selector}`));
    expect(green.sort()).toEqual(
      [
        // A verified fact, written as a tag (proven address, verified mission, confirmed by the client, URSSAF, SIRET).
        "base.css: .tag-proof",
        // The home page v2: the founder's slot of the register (empty today) and its swatch.
        "home-registre.css: .rg-you",
        "home-registre.css: .rg-sw-you",
        // The example mission of the opening, verified by its payment: its card, the two beams that fed it, their
        // ports, and the poinçon's square before the one point that speaks of verification.
        "home.css: .hx-card",
        "home.css: .beam",
        "home.css: .beam-port",
        "home.css: .hx-points .hx-point-proof::before",
        // The label of the one section about proof (BRAND_BOOK_V2 §5), and the six verified facts it defines.
        "home.css: .home .kicker-proof",
        "home-sections.css: .vf-tick",
        "home-sections.css: .vf-tick circle",
        "home-sections.css: @keyframes vf-tick > 100%",
        // The two facts a third party verified on the example profile of the company bento (never the availability).
        "home-bento.css: .mock-facts .is-proof",
        // The journey: green only once the mission is verified (step 9, or the client's confirmation).
        'home-journey.css: .mp[data-step="9"] .mp-rail a[aria-current]::before',
        'home-journey.css: .mp[data-step="9"] .mp-trace-fill',
        'home-journey.css: @media (scripting: enabled) > .mp[data-step="9"] .mp-steps li:last-child .mp-n',
        "home-journey.css: .mp-beam.is-proof",
        "home-journey.css: .mp-fill",
        "home-journey.css: .mp-stack",
        "home-journey.css: .mp-scene[data-verified] .mp-card",
        "home-journey.css: .mp-ring",
        "home-journey.css: @media (max-width: 63.99rem) > .mp-scene[data-verified]::before",
        // Lot 2: an answer of the person's own register that cites them with a link (the storefront's .rg-you), and
        // the same count as the bar of its funnel step. A measured fact, dated, whose source is the answer.
        "app-registre.css: .cr-cited",
        'visibility.css: .vis-step[data-step="cited"] .vis-bar span',
      ].sort(),
    );
  });

  it("holds the same rule over the sheets of @proofseen/brand that React imports", () => {
    // Listed from the folder: a new brand sheet is read here the day it is written, so the guard cannot go quiet.
    const sheets = readdirSync(brand).filter((f) => f.endsWith(".css"));
    expect(sheets.sort()).toEqual(["chrome.css", "profile-card.css", "seal.css", "tokens.css"]);
    const green = sheets.flatMap((file) => greenRules(read(brand, file)).map((selector) => `${file}: ${selector}`));
    expect(green.sort()).toEqual(
      [
        // The card's register: the square of a verified fact, and the key of the legend that names it.
        "profile-card.css: .ps-legend .k-proof::before,.fc-proof li::before",
        // The poinçon: the square at the end of the line of proof, the cartouche, the square and stamp of a proven
        // address, and the ring of ink at the moment of the strike.
        "seal.css: .proofline::before",
        "seal.css: .seal",
        "seal.css: .sq",
        "seal.css: .stamp",
        "seal.css: @keyframes ps-ink > 0%,76%",
      ].sort(),
    );
  });

  it("puts the proof tag only on verified facts", () => {
    const users = filesUnder(src)
      .filter((f) => /\.tsx?$/.test(f) && readFileSync(f, "utf8").includes("tag-proof"))
      .map((f) => relative(src, f).replace(/\\/g, "/"))
      .sort();
    // Lot 2 moved the register of /app/preuves to the poinçon (components/registre/ProofRegister.tsx, in seal.test.ts):
    // a verified mission or a proven address is no longer a flat tag there, and a closed request reads in ink.
    expect(users).toEqual(["components/visibility/ProfileChecklist.tsx"]);
  });

  it("draws every focus ring of a field in the focus colour, at AA contrast in both themes", () => {
    for (const file of styles) {
      const css = read(src, "styles", file).replace(/\/\*[\s\S]*?\*\//g, "");
      for (const rule of css.match(/[^{}]*:focus(?:-visible)?[^{}]*\{[^}]*\}/g) ?? []) {
        const body = rule.slice(rule.indexOf("{"));
        if (/outline:/.test(body) && !/outline:\s*(?:none|0)\b/.test(body)) expect(body, `${file}: ${rule.trim()}`).toMatch(/var\(--ps-focus\)/);
      }
    }
    for (const theme of ["dark", "light"] as const) {
      const p = PALETTE[theme];
      for (const ground of [p.bg, p.surface, p.raised]) expect(contrastRatio(p.focus, ground)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("typography of the visible text (Kensa M7)", () => {
  it("writes no em dash in any string, label or markup of the application; comments aside", () => {
    const offenders = filesUnder(src)
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) =>
        readFileSync(f, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|\s)\/\/.*$/gm, "$1")
          .includes(String.fromCodePoint(0x2014)),
      )
      .map((f) => relative(src, f).replace(/\\/g, "/"));
    expect(offenders).toEqual([]);
  });
});

describe("fonts", () => {
  it("serves the two brand fonts and nothing else", () => {
    const pkg = JSON.parse(read(web, "package.json")) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).filter((name) => name.startsWith("@fontsource"))).toEqual([]);
    for (const file of filesUnder(src).filter((f) => /\.(tsx?|css)$/.test(f))) {
      expect(readFileSync(file, "utf8"), relative(web, file)).not.toMatch(/@fontsource|Newsreader|Inter Variable/);
    }
    expect(existsSync(join(web, "public", FONT_FILES.display))).toBe(true);
    expect(existsSync(join(web, "public", FONT_FILES.mono))).toBe(true);
  });

  it("preloads the display font from the root layout, and only that one", () => {
    const layout = read(app, "[lang]", "layout.tsx");
    expect(layout).toContain('<link rel="preload" href={FONT_FILES.display} as="font" type="font/woff2" crossOrigin="" />');
    expect(layout).not.toContain("FONT_FILES.mono");
    expect(layout).toContain('import "@proofseen/brand/tokens.css";');
    expect(layout).toContain('import "@proofseen/brand/chrome.css";');
  });
});

describe("indexing", () => {
  const layout = read(app, "[lang]", "layout.tsx");

  it("keeps noindex as the default of the [lang] segment, and for the whole connected space", () => {
    expect(layout).toContain("robots: { index: false, follow: false }");
    expect(read(app, "[lang]", "app", "layout.tsx")).toContain("robots: { index: false, follow: false }");
  });

  it("opens the home page to search engines, with its canonical address", () => {
    const home = read(app, "[lang]", "page.tsx");
    expect(home).toContain("robots: { index: true, follow: true }");
    expect(home).toContain("canonical: `/${lang}`");
  });

  it("opens nothing else: only pages listed in the sitemap opt in, never a private one", () => {
    const sitemap = read(app, "sitemap-pages.xml", "route.ts");
    const optIn = filesUnder(join(app, "[lang]")).filter((f) => f.endsWith(".tsx") && /index:\s*true/.test(readFileSync(f, "utf8")));
    expect(optIn.map((f) => relative(app, f).replace(/\\/g, "/"))).toEqual(["[lang]/page.tsx"]);
    expect(sitemap).toContain('"/fr", "/en"');
    for (const privatePage of ["app", "espace", "confirmer-mission", "connexion", "creer-un-compte", "inscription"]) {
      for (const file of filesUnder(join(app, "[lang]", privatePage)).filter((f) => f.endsWith(".tsx"))) {
        expect(readFileSync(file, "utf8"), relative(app, file)).not.toMatch(/index:\s*true/);
      }
    }
  });
});

describe("share card and icons", () => {
  it("announces the share card of each language, 1200 x 630, with its sentence", () => {
    for (const lang of ["fr", "en"] as const) {
      const meta = shareMetadata(lang, { title: "T", description: "D", path: `/${lang}` });
      expect(meta.openGraph).toMatchObject({ url: `/${lang}`, images: [{ url: SHARE_CARD[lang].src, width: 1200, height: 630, alt: SHARE_CARD[lang].alt }] });
      expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
      expect(existsSync(join(web, "public", SHARE_CARD[lang].src))).toBe(true);
    }
  });

  it("builds absolute addresses from the configured origin, and falls back to production", () => {
    expect(siteOrigin("https://preview.example/some/path")).toBe("https://preview.example");
    expect(siteOrigin("")).toBe(DEFAULT_SITE_ORIGIN);
    expect(siteOrigin("not a url")).toBe(DEFAULT_SITE_ORIGIN);
  });

  it("drops the icons of the former charter", () => {
    expect(existsSync(join(app, "[lang]", "icon.svg"))).toBe(false);
    expect(existsSync(join(app, "[lang]", "app", "apple-icon.png"))).toBe(false);
    expect(readdirSync(join(web, "public", "icons"))).toEqual(["badge-96.png"]);
  });
});
