import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AMBIENT_CAP,
  AMBIENT_WORST,
  CHROME_CSS,
  CONTRAST_PAIRS,
  GROUNDS,
  HEADER_INK,
  MONOGRAM_SMALL_PATH,
  PALETTE,
  PAPER_INKS,
  PROFILE_CARD_CSS,
  SEAL_CSS,
  THEME_COLOR,
  TYPE_SCALE,
  contrastRatio,
  edgeSpotCss,
  fluid,
  mix,
  renderChromeCss,
  renderProfileCardCss,
  renderSealCss,
  renderTokensCss,
} from "../src/index";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const brandDir = (app: string): string => join(root, "apps", app, "public", "brand");
const p = PALETTE.dark;
const ratio = (fg: string, bg: string): number => Math.round(contrastRatio(fg, bg) * 100) / 100;

/** Every sheet the package writes, as React imports it. */
const SHEETS = { "tokens.css": renderTokensCss(), "chrome.css": renderChromeCss(), "profile-card.css": renderProfileCardCss(), "seal.css": renderSealCss() };

/** A light theme, in any of the forms it took in v1 or could take again. */
const LIGHT_THEME = /prefers-color-scheme\s*:\s*light|data-theme|color-scheme\s*:\s*(?:light|normal)|color-scheme\s*:\s*[^;}]*\blight\b/i;

describe("dark only (BRAND_BOOK_V2 section 2)", () => {
  it("has one palette, the dark one, and one browser colour equal to its page background", () => {
    expect(Object.keys(PALETTE)).toEqual(["dark"]);
    expect(THEME_COLOR).toBe("#0a0b10");
    expect(THEME_COLOR).toBe(p.bg);
  });

  it.each(Object.entries(SHEETS))("%s brings back no light theme, whatever the options", (_name, css) => {
    expect(css).not.toMatch(LIGHT_THEME);
    for (const webFonts of [true, false]) expect(renderTokensCss({ webFonts })).not.toMatch(LIGHT_THEME);
  });

  it("declares the scheme once, dark, on :root, and nowhere else", () => {
    const css = renderTokensCss();
    expect(css.match(/color-scheme:/g)).toHaveLength(1);
    expect(css).toMatch(/^:root\{color-scheme:dark;/m);
    // One block of colours: a second :root with colours would be a theme by another name.
    expect(css.match(/--ps-bg:/g)).toHaveLength(1);
  });

  it("keeps the paper inks for the printed logo and the favicon tab only, out of every sheet", () => {
    for (const css of Object.values(SHEETS)) for (const hex of Object.values(PAPER_INKS)) expect(css.toLowerCase()).not.toContain(hex);
  });
});

describe("brand tokens", () => {
  it("tokens.css is exactly what src/tokens.ts renders", () => {
    expect(readFileSync(join(root, "packages", "brand", "tokens.css"), "utf8")).toBe(renderTokensCss());
  });

  it("every listed pair meets WCAG AA", () => {
    const failures = CONTRAST_PAIRS.filter(({ fg, bg, min }) => contrastRatio(p[fg], p[bg]) < min).map(
      ({ fg, bg }) => `${fg} on ${bg}: ${contrastRatio(p[fg], p[bg]).toFixed(2)}`,
    );
    expect(failures).toEqual([]);
  });

  it("lists every text colour on every ground, controls and the aura at 3:1", () => {
    for (const fg of ["text", "muted", "faint", "proof", "signal", "danger", "focus", "auraText"] as const) {
      for (const bg of GROUNDS) expect(CONTRAST_PAIRS).toContainEqual({ fg, bg, min: 4.5 });
    }
    for (const bg of GROUNDS) {
      expect(CONTRAST_PAIRS).toContainEqual({ fg: "lineStrong", bg, min: 3 });
      expect(CONTRAST_PAIRS).toContainEqual({ fg: "aura", bg, min: 3 });
    }
  });

  it("lands on the ratios the brand book measured", () => {
    expect(ratio(p.text, p.bg)).toBe(17.12);
    expect(ratio(p.text, p.bgDeep)).toBe(17.54);
    expect(ratio(p.faint, p.overlay)).toBe(4.8);
    expect(ratio(p.auraText, p.bg)).toBe(8.38);
    expect(ratio(p.aura, p.raised)).toBe(4.41);
    expect(ratio(p.lineStrong, p.overlay)).toBe(3.35);
    expect(ratio(p.onProof, p.proof)).toBe(10.51);
    expect(ratio(p.text, p.proofWash)).toBe(14.61);
  });

  it("never sets the paper text on the full aura, and the line never edges a control", () => {
    expect(contrastRatio(p.text, p.aura)).toBeLessThan(4.5);
    expect(CONTRAST_PAIRS).not.toContainEqual(expect.objectContaining({ fg: "text", bg: "aura" }));
    expect(contrastRatio(p.line, p.bg)).toBeLessThan(3);
    expect(CONTRAST_PAIRS.some(({ fg }) => fg === "line")).toBe(false);
  });

  it("makes the focus the aura made legible, at 3:1 on every ground", () => {
    expect(p.focus).toBe(p.auraText);
    for (const bg of GROUNDS) expect(contrastRatio(p.focus, p[bg])).toBeGreaterThanOrEqual(3);
  });

  it("measures contrast like WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("lands the fluid type scale exactly on its end points, body at 18 px, hero step 6", () => {
    expect(fluid(16, 16)).toBe("1rem");
    const step = (name: string) => TYPE_SCALE.find((s) => s.name === name);
    expect(step("0")).toMatchObject({ min: 16, max: 18 });
    expect(TYPE_SCALE.at(-1)?.name).toBe("6");
    const hero = step("6");
    expect(hero && fluid(hero.min, hero.max)).toBe("clamp(3rem, 1.5915rem + 6.0094vw, 7rem)");
    expect(renderTokensCss()).toContain("--ps-step-0:clamp(1rem, 0.956rem + 0.1878vw, 1.125rem);");
    expect(renderTokensCss()).toContain("--ps-step-5:clamp(2.5rem, 1.6197rem + 3.7559vw, 5rem);");
  });
});

describe("the light: glow and ambience (BRAND_BOOK_V2 sections 2.2 and 4)", () => {
  const css = renderTokensCss();
  const token = (name: string): string => new RegExp(`--ps-${name}:([^;]*);`).exec(css)?.[1] ?? "";
  const hex = (r: number, g: number, b: number): string => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

  it("writes every halo and ambience in rgb() of a palette colour (or the black of a shadow)", () => {
    const known = new Set([...Object.values(p), "#000000"]);
    const stray = [...css.matchAll(/rgb\((\d+) (\d+) (\d+) \/ [.\d]+\)/g)]
      .map((m) => hex(Number(m[1]), Number(m[2]), Number(m[3])))
      .filter((h) => !known.has(h));
    expect(stray).toEqual([]);
    expect(css).not.toMatch(/rgba\(|hsla?\(|#[0-9a-f]{3,4}\b|#[0-9a-f]{8}\b/i);
  });

  it("names the tokens the screens use", () => {
    for (const name of ["glow-proof", "glow-proof-strike", "halo-proof", "glow-aura", "glow-cta", "edge-spot", "edge-spot-proof", "ambient-hero", "ambient-section", "ambient-deep", "header-ink", "aura", "aura-text", "azur", "bg-deep", "overlay", "step-6", "section-y", "radius-card", "radius-media", "radius-pill", "dur-aurora", "dur-glow", "dur-media", "ease-glow"]) {
      expect(token(name), name).not.toBe("");
    }
  });

  it("keeps every layer of ambience under the caps: 18 % aura, 10 % azure", () => {
    const [ar, ag, ab] = [124, 108, 255];
    const [zr, zg, zb] = [61, 123, 255];
    expect(hex(ar, ag, ab)).toBe(p.aura);
    expect(hex(zr, zg, zb)).toBe(p.azur);
    for (const name of ["ambient-hero", "ambient-section", "ambient-deep"]) {
      const value = token(name);
      for (const m of value.matchAll(/rgb\((\d+) (\d+) (\d+) \/ ([.\d]+)\)/g)) {
        const colour = hex(Number(m[1]), Number(m[2]), Number(m[3]));
        const alpha = Number(m[4]);
        expect([p.aura, p.azur], `${name}: ${colour}`).toContain(colour);
        expect(alpha, `${name}: ${m[0]}`).toBeLessThanOrEqual(colour === p.aura ? AMBIENT_CAP.aura : AMBIENT_CAP.azur);
      }
    }
  });

  it("keeps text legible at the worst point of the ambience (#22264f)", () => {
    expect(AMBIENT_WORST).toBe("#22264f");
    for (const fg of [p.text, p.muted, p.faint, p.auraText, p.proof, p.signal, p.danger]) expect(contrastRatio(fg, AMBIENT_WORST)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.lineStrong, AMBIENT_WORST)).toBeGreaterThanOrEqual(3);
    expect(ratio(p.faint, AMBIENT_WORST)).toBe(4.58);
  });

  it("keeps the header at 90 % of ink at least: text stays AA even over a white photo", () => {
    expect(HEADER_INK).toBeGreaterThanOrEqual(0.9);
    expect(token("header-ink")).toBe(`rgb(10 11 16 / ${String(HEADER_INK).replace(/^0\./, ".")})`);
    const overWhite = mix("#ffffff", p.bg, HEADER_INK);
    for (const fg of [p.text, p.muted, p.faint, p.auraText]) expect(contrastRatio(fg, overWhite)).toBeGreaterThanOrEqual(4.5);
    expect(CHROME_CSS).toMatch(/@supports \(\(-webkit-backdrop-filter:blur\(1px\)\) or \(backdrop-filter:blur\(1px\)\)\)\{\.top\{background:var\(--ps-header-ink\);/);
    // Outside @supports the header is the opaque page ground.
    expect(CHROME_CSS).toMatch(/^\.top\{[^}]*background:var\(--ps-bg\);/m);
  });

  it("animates no box-shadow and no filter, anywhere in the brand sheets", () => {
    for (const [name, sheet] of Object.entries(SHEETS)) {
      for (const m of sheet.matchAll(/transition(?:-property)?:([^;}]*)/g)) expect(m[1], name).not.toMatch(/box-shadow|filter|\ball\b/);
      for (const m of sheet.matchAll(/@keyframes[^{]*\{((?:[^{}]*\{[^}]*\})*)\}/g)) expect(m[1], name).not.toMatch(/box-shadow|filter/);
    }
  });

  it("lets an element that follows the pointer resolve the spot with its own coordinates", () => {
    // Declared on :root only, var(--spot-x) would resolve there and a card's coordinates would never reach the spot.
    expect(css).toMatch(/^:where\(\[data-spot\]\)\{--ps-edge-spot:radial-gradient\(260px circle at var\(--spot-x, 50%\) var\(--spot-y, 0%\),[^}]*--ps-edge-spot-proof:/m);
  });

  it("lights the edge of a card in CSS only, under hover, with a transition of border-color alone", () => {
    const rule = edgeSpotCss([".a", ".b"]);
    expect(rule).toMatch(/^@media \(hover:hover\) and \(pointer:fine\)\{\.a:hover,\.b:hover\{border-color:transparent;/);
    expect(rule).toContain("var(--ps-edge-spot) border-box");
    expect(PROFILE_CARD_CSS).toContain(edgeSpotCss([".fiche-card"]));
    expect(PROFILE_CARD_CSS).toMatch(/\.fiche-card\{[^}]*transition:border-color [^;}]*\}/);
  });
});

describe("brand sheets", () => {
  it("chrome.css is exactly what src/chrome.ts renders", () => {
    expect(readFileSync(join(root, "packages", "brand", "chrome.css"), "utf8")).toBe(renderChromeCss());
  });

  it("chrome hides nothing, types no colour and keeps hover where hover exists", () => {
    expect(CHROME_CSS).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0/i);
    expect(CHROME_CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    for (const rule of CHROME_CSS.split("\n").filter((line) => line.includes(":hover"))) expect(rule).toMatch(/^@media \(hover:hover\)/);
  });

  it("lights the main button in violet on hover and focus, never in green", () => {
    expect(CHROME_CSS).toContain(".btn-primary:focus-visible,.cta:focus-visible{box-shadow:var(--ps-glow-cta)}");
    expect(CHROME_CSS).toContain(".btn-primary:hover:not(:disabled),.cta:hover{box-shadow:var(--ps-glow-cta)}");
    expect(CHROME_CSS).not.toMatch(/--ps-(?:proof|glow-proof|halo-proof|edge-spot-proof)/);
  });

  it("the phone menu fades at its right edge to show it scrolls, and drops the fade once it fits", () => {
    expect(CHROME_CSS).toMatch(/\.nav\{[^}]*overflow-x:auto[^}]*mask-image:linear-gradient\(to right/);
    expect(CHROME_CSS).toMatch(/@media \(min-width:64rem\)\{[^\n]*\.nav\{[^}]*mask-image:none/);
  });

  it("profile-card.css is exactly what src/profile-card.ts renders, under the same rules as the chrome", () => {
    expect(readFileSync(join(root, "packages", "brand", "profile-card.css"), "utf8")).toBe(renderProfileCardCss());
    expect(PROFILE_CARD_CSS).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0/i);
    expect(PROFILE_CARD_CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    for (const rule of PROFILE_CARD_CSS.split("\n").filter((line) => line.includes(":hover"))) expect(rule).toMatch(/^@media \(hover:hover\)/);
    // The card wears no green light: its verified squares stay flat, its edge lights in violet.
    expect(PROFILE_CARD_CSS).not.toMatch(/--ps-(?:glow-proof|halo-proof|edge-spot-proof)/);
  });

  it("seal.css is exactly what src/seal.ts renders, under the same rules as the chrome", () => {
    expect(readFileSync(join(root, "packages", "brand", "seal.css"), "utf8")).toBe(renderSealCss());
    expect(SEAL_CSS).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity|font-size\s*:\s*0|scale[XY]?\(\s*0\s*\)/i);
    expect(SEAL_CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(SEAL_CSS).not.toContain(":hover");
  });

  it("gives the proof halo to the cartouche and the filled squares of the poinçon, and to nothing else", () => {
    const lit = SEAL_CSS.split("\n").filter((line) => /--ps-(?:glow-proof|halo-proof|edge-spot-proof)/.test(line)).map((line) => line.slice(0, line.indexOf("{")));
    expect(lit).toEqual([".proofline::before", ".seal", ".sq"]);
    expect(SEAL_CSS).toContain(".sq.open{background:none;border:1px solid var(--ps-line-strong);box-shadow:none}");
  });

  it("the seal strikes only under no-preference, from a visible state, and its ring rests transparent", () => {
    for (const rule of SEAL_CSS.split("\n").filter((line) => /animation:/.test(line))) expect(rule).toMatch(/^@media \(prefers-reduced-motion:no-preference\)/);
    expect(SEAL_CSS).toContain(".seal::after{content:\"\";position:absolute;inset:-1px;border:1px solid transparent;");
    expect(SEAL_CSS).toMatch(/@keyframes ps-strike\{0%,63%\{transform:scale\(1\.06\)/);
    expect(SEAL_CSS).toMatch(/@keyframes ps-ink\{[^\n]*100%\{transform:scale\([^)]*\);border-color:transparent\}\}/);
  });

  it("can leave out the web fonts (static site of the hub)", () => {
    const standalone = renderTokensCss({ webFonts: false });
    expect(standalone).not.toContain("url(");
    expect(standalone).toContain('src:local("Georgia")');
  });

  it("writes no em dash and no hard-coded colour outside the palette", () => {
    for (const css of Object.values(SHEETS)) expect(css).not.toContain(String.fromCodePoint(0x2014));
    const known = new Set(Object.values(p));
    const stray = [...renderTokensCss().matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()).filter((h) => !known.has(h));
    expect(stray).toEqual([]);
  });
});

describe("brand files", () => {
  const web = readdirSync(brandDir("web")).sort();
  const svg = (name: string): string => readFileSync(join(brandDir("web"), name), "utf8");

  it("ships the same files, byte for byte, to the web app and the landing", () => {
    expect(readdirSync(brandDir("landing")).sort()).toEqual(web);
    for (const file of web) {
      expect(readFileSync(join(brandDir("landing"), file)).equals(readFileSync(join(brandDir("web"), file)))).toBe(true);
    }
  });

  it("draws every letter as outlines: no SVG depends on an installed font", () => {
    for (const file of web.filter((f) => f.endsWith(".svg"))) expect(svg(file)).not.toMatch(/<text|font-family/);
  });

  it("paints the site's logos with the v2 palette, and the paper logos with the paper inks", () => {
    for (const name of ["ps-lockup-dark.svg", "ps-lockup-display-dark.svg"]) {
      expect(svg(name)).toContain(`fill="${p.proof}"`);
      expect(svg(name)).toContain(`fill="${p.text}"`);
    }
    expect(svg("ps-monogram-dark.svg")).toContain(`fill="${p.proof}"`);
    expect(svg("ps-lockup-light.svg")).toContain(`fill="${PAPER_INKS.proof}"`);
    expect(svg("ps-lockup-light.svg")).toContain(`fill="${PAPER_INKS.text}"`);
    expect(svg("ps-lockup-mono.svg")).not.toMatch(/#[0-9a-f]{6}/i);
    // The browser tab may be light: only the favicon keeps a second ink.
    expect(svg("favicon.svg")).toContain(PAPER_INKS.proof);
    expect(svg("favicon.svg")).toContain(p.proof);
    expect(svg("favicon.svg")).toContain(`d="${MONOGRAM_SMALL_PATH}"`);
  });

  it("draws the share card and the app icons on the v2 night", () => {
    const assets = join(root, "packages", "brand", "assets");
    for (const name of ["og-fr.svg", "og-en.svg", "icon.svg", "maskable.svg", "apple-touch-icon.svg"]) {
      expect(readFileSync(join(assets, name), "utf8"), name).toContain(`fill="${p.bg}"`);
    }
  });

  it("renders the icons at the sizes the manifest and the share card announce", () => {
    const size = (name: string): [number, number] => {
      const png = readFileSync(join(brandDir("web"), name));
      return [png.readUInt32BE(16), png.readUInt32BE(20)];
    };
    expect(size("icon-192.png")).toEqual([192, 192]);
    expect(size("icon-512.png")).toEqual([512, 512]);
    expect(size("maskable-192.png")).toEqual([192, 192]);
    expect(size("maskable-512.png")).toEqual([512, 512]);
    expect(size("apple-touch-icon.png")).toEqual([180, 180]);
    expect(size("og-fr.png")).toEqual([1200, 630]);
    expect(size("og-en.png")).toEqual([1200, 630]);
  });
});
