import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { fr } from "../src/i18n/fr";
import { buildGrid, parseHex, shouldAnimate, MIN_WEBGL_WIDTH } from "../src/scripts/field-math";
import { POOL, RUNS, TOP, hitsUpTo, pct, shortlist, wilson } from "../src/scripts/sim-math";

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

describe("hero simulator (fictitious data)", () => {
  it("computes the Wilson interval like the measurement package", () => {
    const ci = wilson(11, 30);
    expect(ci.p).toBeCloseTo(0.3667, 4);
    expect(ci.lo).toBeCloseTo(0.2187, 3);
    expect(ci.hi).toBeCloseTo(0.5448, 3);
    expect(wilson(0, 10).lo).toBe(0);
    expect(wilson(10, 10).hi).toBe(1);
    expect(wilson(3, 0)).toEqual({ p: 0, lo: 0, hi: 1 });
    expect(wilson(5, 3)).toEqual({ p: 0, lo: 0, hi: 1 });
  });

  it("tells a consistent story: 30 answers, 11 in the top 5, ending on a hit", () => {
    expect(RUNS).toHaveLength(30);
    expect(hitsUpTo(RUNS.length)).toBe(11);
    expect(RUNS.at(-1)).not.toBeNull();
    RUNS.forEach((r) => r === null || expect(r >= 1 && r <= TOP).toBe(true));
    expect(pct(wilson(11, 30).p)).toBe("37");
  });

  it("builds a top 5 of distinct fictitious profiles with 'you' at its rank", () => {
    RUNS.forEach((rank, run) => {
      const list = shortlist(run);
      expect(list).toHaveLength(TOP);
      expect(new Set(list).size).toBe(TOP);
      list.forEach((idx) => expect(idx === -1 || (idx >= 0 && idx < POOL.length)).toBe(true));
      if (rank === null) expect(list).not.toContain(-1);
      else expect(list.indexOf(-1)).toBe(rank - 1);
    });
  });

  it("never names a real-looking person: initials only", () => {
    POOL.forEach((p) => expect(p).toMatch(/^\p{Lu}\. \p{Lu}\. · /u));
  });
});
