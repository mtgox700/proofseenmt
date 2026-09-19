import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { fr } from "../src/i18n/fr";
import { buildGrid, gridSizeFor, parseHex, project, reveal, shouldAnimate, targetNode, toPixels, MIN_WEBGL_WIDTH } from "../src/scripts/field-math";

/** Recursively lists every string with its path, so FR and EN can be compared field by field. */
const leaves = (value: unknown, path = ""): [string, string][] => {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (typeof value === "object" && value !== null) return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
};

describe("copy (brand and truth rules)", () => {
  it("has exactly the same structure in French and English", () => {
    expect(leaves(en).map(([p]) => p)).toEqual(leaves(fr).map(([p]) => p));
  });

  it("never uses hype or manipulation vocabulary (MARQUE §4)", () => {
    const banned = /n°\s?1|numéro un|number one|#1\b|boost|hack|explos|secret des algorithmes|x fois plus|\d+x more/i;
    [...leaves(fr), ...leaves(en)].forEach(([path, text]) => expect(text, path).not.toMatch(banned));
  });

  it("only mentions a guarantee to deny it", () => {
    [...leaves(fr), ...leaves(en)]
      .filter(([, text]) => /garant|guarant/i.test(text))
      .forEach(([path, text]) => expect(text, path).toMatch(/aucun|aucune|no |not |non|\?/i));
  });

  it("labels the report preview as fictitious", () => {
    expect(fr.method.preview.legend).toMatch(/fictives/);
    expect(en.method.preview.legend).toMatch(/fictitious/);
  });
});

describe("field maths", () => {
  it("builds a normalised grid", () => {
    const g = buildGrid(4, 3);
    expect(g.positions).toHaveLength(24);
    expect([g.positions[0], g.positions[1]]).toEqual([-1, -1]);
    expect([g.positions[22], g.positions[23]]).toEqual([1, 1]);
    expect(() => buildGrid(1, 3)).toThrow(RangeError);
  });

  it("keeps the proof point inside the visible field on every screen size", () => {
    [320, 800, 1920].forEach((w) => {
      const { cols, rows } = gridSizeFor(w);
      const t = targetNode(buildGrid(cols, rows));
      const clip = project(t.x, t.y, 3, w / 800);
      expect(Math.abs(clip.x)).toBeLessThan(1);
      expect(Math.abs(clip.y)).toBeLessThan(1);
      const px = toPixels(clip, w, 800);
      expect(px.x).toBeGreaterThan(0);
      expect(px.x).toBeLessThan(w);
    });
  });

  it("never projects to Infinity on a zero-size box", () => {
    const p = project(0.2, 0.1, 1, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it("reveals the proof point progressively after a delay", () => {
    expect(reveal(0)).toBe(0);
    expect(reveal(1.4)).toBe(0);
    expect(reveal(2.2)).toBeGreaterThan(0);
    expect(reveal(10)).toBe(1);
  });

  it("runs WebGL only on capable desktop-class devices (performance budget)", () => {
    const desktop = { reducedMotion: false, saveData: false, webgl2: true, cores: 8, width: 1440, finePointer: true };
    expect(shouldAnimate(desktop)).toBe(true);
    expect(shouldAnimate({ ...desktop, reducedMotion: true })).toBe(false);
    expect(shouldAnimate({ ...desktop, saveData: true })).toBe(false);
    expect(shouldAnimate({ ...desktop, webgl2: false })).toBe(false);
    expect(shouldAnimate({ ...desktop, cores: 2 })).toBe(false);
    expect(shouldAnimate({ ...desktop, width: MIN_WEBGL_WIDTH - 1 })).toBe(false);
    expect(shouldAnimate({ ...desktop, finePointer: false })).toBe(false);
  });

  it("parses brand hex colours and rejects anything else", () => {
    expect(parseHex("#0b6e54")).toEqual([11 / 255, 110 / 255, 84 / 255]);
    expect(parseHex(" #3FCF9C ")).not.toBeNull();
    expect(parseHex("rgb(0,0,0)")).toBeNull();
  });
});
