import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHROME_CSS, CONTRAST_PAIRS, MONOGRAM_SMALL_PATH, PALETTE, THEME_COLOR, TYPE_SCALE, contrastRatio, fluid, renderChromeCss, renderTokensCss } from "../src/index";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const brandDir = (app: string): string => join(root, "apps", app, "public", "brand");

describe("brand tokens", () => {
  it("tokens.css is exactly what src/tokens.ts renders", () => {
    expect(readFileSync(join(root, "packages", "brand", "tokens.css"), "utf8")).toBe(renderTokensCss());
  });

  it.each(["dark", "light"] as const)("every listed pair meets WCAG AA in the %s theme", (theme) => {
    const palette = PALETTE[theme];
    const failures = CONTRAST_PAIRS.filter(({ fg, bg, min }) => contrastRatio(palette[fg], palette[bg]) < min).map(
      ({ fg, bg }) => `${fg} on ${bg}: ${contrastRatio(palette[fg], palette[bg]).toFixed(2)}`,
    );
    expect(failures).toEqual([]);
  });

  it("measures contrast like WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("gives one theme-color per theme, equal to the page background", () => {
    expect(THEME_COLOR).toEqual({ dark: PALETTE.dark.bg, light: PALETTE.light.bg });
  });

  it("lands the fluid type scale exactly on its end points", () => {
    expect(fluid(16, 16)).toBe("1rem");
    const hero = TYPE_SCALE.at(-1);
    expect(hero && fluid(hero.min, hero.max)).toBe("clamp(2.4881rem, 1.7894rem + 2.9812vw, 4.4725rem)");
  });

  it("chrome.css is exactly what src/chrome.ts renders", () => {
    expect(readFileSync(join(root, "packages", "brand", "chrome.css"), "utf8")).toBe(renderChromeCss());
  });

  it("chrome hides nothing, types no colour and keeps hover where hover exists", () => {
    expect(CHROME_CSS).not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0/i);
    expect(CHROME_CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    for (const rule of CHROME_CSS.split("\n").filter((line) => line.includes(":hover"))) expect(rule).toMatch(/^@media \(hover:hover\)/);
  });

  it("can leave out the theme switch and the web fonts (hub, static site)", () => {
    const inline = renderTokensCss({ themeAttributes: false });
    expect(inline).not.toContain("data-theme");
    expect(inline).toContain("@media (prefers-color-scheme:light){:root{color-scheme:light;");
    const standalone = renderTokensCss({ themeAttributes: false, webFonts: false });
    expect(standalone).not.toContain("url(");
    expect(standalone).toContain('src:local("Georgia")');
  });

  it("writes no em dash and no hard-coded colour outside the palette", () => {
    const css = renderTokensCss();
    expect(css).not.toContain(String.fromCodePoint(0x2014));
    const known = new Set([...Object.values(PALETTE.dark), ...Object.values(PALETTE.light)]);
    const stray = [...css.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()).filter((hex) => !known.has(hex));
    expect(stray).toEqual([]);
  });
});

describe("brand files", () => {
  const web = readdirSync(brandDir("web")).sort();

  it("ships the same files, byte for byte, to the web app and the landing", () => {
    expect(readdirSync(brandDir("landing")).sort()).toEqual(web);
    for (const file of web) {
      expect(readFileSync(join(brandDir("landing"), file)).equals(readFileSync(join(brandDir("web"), file)))).toBe(true);
    }
  });

  it("draws every letter as outlines: no SVG depends on an installed font", () => {
    for (const file of web.filter((f) => f.endsWith(".svg"))) {
      expect(readFileSync(join(brandDir("web"), file), "utf8")).not.toMatch(/<text|font-family/);
    }
  });

  it("paints the logos with the palette of their theme", () => {
    const svg = (name: string): string => readFileSync(join(brandDir("web"), name), "utf8");
    for (const theme of ["dark", "light"] as const) {
      expect(svg(`ps-lockup-${theme}.svg`)).toContain(`fill="${PALETTE[theme].proof}"`);
      expect(svg(`ps-lockup-${theme}.svg`)).toContain(`fill="${PALETTE[theme].text}"`);
      expect(svg(`ps-monogram-${theme}.svg`)).toContain(`fill="${PALETTE[theme].proof}"`);
    }
    expect(svg("ps-lockup-mono.svg")).not.toMatch(/#[0-9a-f]{6}/i);
    expect(svg("favicon.svg")).toContain(PALETTE.light.proof);
    expect(svg("favicon.svg")).toContain(PALETTE.dark.proof);
    expect(svg("favicon.svg")).toContain(`d="${MONOGRAM_SMALL_PATH}"`);
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
