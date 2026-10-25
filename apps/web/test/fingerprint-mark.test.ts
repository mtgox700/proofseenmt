import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { PAPER_INKS } from "@proofseen/brand";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FingerprintMark, FingerprintStamp, fingerprintLabel, type FingerprintMarkProps } from "../src/components/ui/fingerprint/FingerprintMark";
import {
  FULL_N,
  fingerprintBits,
  fingerprintMark,
  fingerprintMarkSvg,
  fingerprintPrefix,
  fullGrid,
  gridAt,
  levelFor,
  PENDING_FRAME,
  PRINT_LEVEL,
  readingOrder,
  reduce,
  type Grid,
} from "@proofseen/brand/fingerprint-mark";
import { GREEN_FILES, STRIKES_GREEN } from "./support/green-files";

/*
 * The poinçon d'empreinte (LEGENDS_P2_CONCEPT §A.3), prototyped on .war-room/sprints/L1_specimens/fingerprint-mark.html.
 * What it must hold: the same fingerprint draws the same mark; any bit of it changes the full drawing; a changed document
 * changes about half of it; every size is the larger one seen from further away; green only for a sealed act.
 */

const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const sha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // SHA-256 of the empty string
const ZERO = "0".repeat(64);
const flip = (hex: string, bit: number): string => {
  const nibble = Math.floor(bit / 4);
  const value = Number.parseInt(hex[nibble] as string, 16) ^ (8 >> bit % 4);
  return hex.slice(0, nibble) + value.toString(16) + hex.slice(nibble + 1);
};
const cellsOf = (grid: Grid): boolean[] => grid.flatMap((row) => [...row]);
const differing = (a: Grid, b: Grid): number => cellsOf(a).filter((cell, k) => cell !== cellsOf(b)[k]).length;
const mirrored = (grid: Grid): boolean => grid.every((row, i) => row.every((cell, j) => grid[j]?.[i] === cell));
const html = (props: FingerprintMarkProps, stamp = false): string => renderToStaticMarkup(createElement(stamp ? FingerprintStamp : FingerprintMark, props));

describe("the fingerprint and its bits", () => {
  it("accepts the 64 hexadecimal characters of a SHA-256, in either case, and nothing else", () => {
    expect(fingerprintPrefix(EMPTY.toUpperCase())).toBe("E3B0 C442 98FC 1C14");
    expect(() => fingerprintBits(EMPTY.slice(1))).toThrow(/64 hexadecimal/);
    expect(() => fingerprintBits(`${EMPTY.slice(1)}g`)).toThrow(/64 hexadecimal/);
    expect(() => fingerprintMark("", 16)).toThrow();
  });

  it("reads the bits most significant first: bit 0 is the high bit of the first character", () => {
    const bits = fingerprintBits(`8${"0".repeat(62)}1`);
    expect(bits).toHaveLength(256);
    expect(bits[0]).toBe(true);
    expect(bits[255]).toBe(true);
    expect(bits.filter(Boolean)).toHaveLength(2);
  });

  it("reads the cells as a page: from the top vertex down, each row from left to right, every cell once", () => {
    const order = readingOrder(FULL_N);
    expect(order).toHaveLength(256);
    expect(new Set(order.map(([i, j]) => `${i},${j}`)).size).toBe(256);
    expect(order.slice(0, 4)).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [2, 0],
    ]);
    // A screen row is i + j constant; x grows with j - i.
    order.slice(1).forEach(([i, j], k) => {
      const [pi, pj] = order[k] as readonly [number, number];
      if (pi + pj === i + j) expect(j - i).toBeGreaterThan(pj - pi);
      else expect(i + j).toBe(pi + pj + 1);
    });
  });
});

describe("the drawing", () => {
  it("is the same for the same fingerprint, in the geometry and in the markup", () => {
    for (const size of [16, 32, 64, 128]) {
      expect(fingerprintMark(EMPTY, size)).toEqual(fingerprintMark(EMPTY.toUpperCase(), size));
      expect(html({ lang: "fr", fingerprint: EMPTY, size })).toBe(html({ lang: "fr", fingerprint: EMPTY, size }));
    }
  });

  it("keeps its reference drawing, FROZEN: the SHA-256 of the empty string, at every level and in print", () => {
    // FROZEN on 2026-10-25, revision 2 of the poinçon, after Shogun looked at the specimen and gave PASS (L1-120): the
    // document engine prints this geometry in the footer of every PDF (level 64, L1-071), and a printed mark cannot be
    // redrawn. A change here changes the mark of every document already issued: it needs a new DECISION of the Création
    // (L1-120: « aucun autre changement de dessin du poinçon sans nouvelle DÉCISION »), never a quiet update.
    const frozen = {
      levels: [16, 32, 64, 128].map((size) => fingerprintMark(EMPTY, size)),
      print: fingerprintMarkSvg(EMPTY, { frame: PAPER_INKS.text, cells: PAPER_INKS.text }),
      pending: PENDING_FRAME,
    };
    expect(createHash("sha256").update(JSON.stringify(frozen)).digest("hex")).toBe("fc263696661c0bb21b6cad79776ef682d614565e97cdd2cbd8106d37975fe961");
    expect(gridAt(EMPTY, 4).map((row) => row.map(Number).join(""))).toEqual(["0100", "1010", "0111", "0010"]);
    // The 64 px level, the one print draws (PRINT_LEVEL).
    expect(gridAt(EMPTY, 8).map((row) => row.map(Number).join(""))).toEqual(["01110000", "10001001", "10001000", "10010111", "01101010", "00010111", "00011100", "01010101"]);
    expect([16, 32, 64, 128].map((size) => fingerprintMark(EMPTY, size).setCount)).toEqual([0, 7, 28, 123]);
  });

  it("draws the frame and its state only at 16 px: no cell, so no two documents seem the same (L1-090, point 1)", () => {
    for (let k = 0; k < 64; k += 1) {
      const g = fingerprintMark(sha(`liste ${k}`), 16);
      expect(g.cells).toBe("");
      expect(g.detailed).toBe(false);
      expect(html({ lang: "fr", fingerprint: sha(`liste ${k}`), size: 16 }).match(/<path/g)).toHaveLength(1);
    }
    expect(() => fingerprintMark("pas une empreinte", 16)).toThrow(/64 hexadecimal/);
    // Print draws the 64 px level (8 x 8), scaled down in vector: paper resolves what 16 px cannot.
    expect(levelFor(PRINT_LEVEL).n).toBe(8);
  });

  it("leaves a pending frame open on its own path: the middle of each side, a gap of at most 30 %, the corners whole", () => {
    const pending = html({ lang: "fr", fingerprint: EMPTY, size: 64, state: { kind: "pending", word: "À signer" } });
    const filed = html({ lang: "fr", fingerprint: EMPTY, size: 64 });
    const frameOf = (markup: string) => /class="ui-fpm-frame" d="([^"]+)"/.exec(markup)?.[1];
    // The same path as the closed frame: nothing is drawn beside it, no bracket offset from it.
    expect(frameOf(pending)).toBe(frameOf(filed));
    expect(pending).toContain(`pathLength="4" stroke-dasharray="${PENDING_FRAME.dasharray}" stroke-dashoffset="${PENDING_FRAME.dashoffset}"`);
    // Walk one side of the pattern (one unit per side, from a corner): drawn, then a single gap centred, then drawn.
    const [dash, gap] = PENDING_FRAME.dasharray.split(" ").map(Number) as [number, number];
    const offset = Number(PENDING_FRAME.dashoffset);
    const drawnAt = (s: number) => (((s + offset) % (dash + gap)) + dash + gap) % (dash + gap) < dash;
    const samples = Array.from({ length: 1000 }, (_, k) => (k + 0.5) / 1000);
    const open = samples.filter((s) => !drawnAt(s));
    expect(open.length / samples.length).toBeLessThanOrEqual(0.3);
    expect(Math.min(...open) + Math.max(...open)).toBeCloseTo(1, 2);
    expect(drawnAt(0.001) && drawnAt(0.999)).toBe(true);
    // Whole at 16 px, where a gap would be a pixel: the word says the state.
    const small = html({ lang: "fr", fingerprint: EMPTY, size: 16, state: { kind: "pending", word: "À signer" } }, true);
    expect(small).not.toContain("stroke-dasharray");
    expect(small).toContain('<span class="ui-fp-word">À signer</span>');
  });

  it("never draws a pending frame under 48 px without its word beside it (rule of the component, L1-120)", () => {
    for (const size of [16, 24, 32, 47]) {
      expect(() => html({ lang: "fr", fingerprint: EMPTY, size, state: { kind: "pending", word: "À signer" } }), `${size} px`).toThrow(/goes with its word/);
      expect(html({ lang: "fr", fingerprint: EMPTY, size, state: { kind: "pending", word: "À signer" } }, true)).toContain(">À signer<");
    }
    // From 48 px the open frame reads by itself; the mark alone is allowed, its word in its name.
    expect(html({ lang: "fr", fingerprint: EMPTY, size: 48, state: { kind: "pending", word: "À signer" } })).toContain("E3B0 C442 98FC 1C14. À signer");
  });

  it("is an emblem: mirrored on its vertical axis at every level", () => {
    for (const hex of [EMPTY, sha("a"), sha("b"), sha("Contrat d'exemple, version 3.")]) {
      for (const n of [16, 8, 4, 2]) expect(mirrored(gridAt(hex, n)), `${hex} at ${n}`).toBe(true);
    }
  });

  it("changes when any single bit of the fingerprint changes: one cell and its mirror, at the full size", () => {
    const base = fullGrid(ZERO);
    expect(cellsOf(base).some(Boolean)).toBe(false);
    for (let bit = 0; bit < 256; bit += 1) {
      const changed = fullGrid(flip(ZERO, bit));
      expect([1, 2], `bit ${bit}`).toContain(differing(base, changed));
      expect(fingerprintMark(flip(ZERO, bit), 128).cells).not.toBe(fingerprintMark(ZERO, 128).cells);
    }
  });

  it("changes about half its cells when the document changes by one comma (avalanche of SHA-256)", () => {
    const a = sha("Contrat d'exemple, version 3.");
    const b = sha("Contrat d'exemple, version 3,");
    const diff = differing(fullGrid(a), fullGrid(b));
    expect(diff).toBe(124);
    // Over many pairs, the share of differing cells stays near one half.
    const shares = Array.from({ length: 200 }, (_, k) => differing(fullGrid(sha(`exemple ${k}`)), fullGrid(sha(`exemple ${k}.`))) / 256);
    const mean = shares.reduce((sum, share) => sum + share, 0) / shares.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it("is, smaller, the same mark seen from further away: each cell the majority of its four, a tie to the top one", () => {
    const grid: Grid = [
      [true, true, false, true],
      [true, false, true, false],
      [true, false, true, true],
      [false, true, true, true],
    ];
    // Blocks: 3 of 4; a tie whose top cell is unset; a tie whose top cell is set; 4 of 4.
    expect(reduce(grid)).toEqual([
      [true, false],
      [true, true],
    ]);
    expect(() => reduce([[true]])).toThrow(/cannot be reduced/);
    // Unbiased: over many fingerprints, about half the cells of every level are set.
    for (const n of [8, 4, 2]) {
      const set = Array.from({ length: 300 }, (_, k) => cellsOf(gridAt(sha(`niveau ${k}`), n)).filter(Boolean).length / (n * n));
      const mean = set.reduce((sum, share) => sum + share, 0) / set.length;
      expect(mean, `level ${n}`).toBeGreaterThan(0.42);
      expect(mean, `level ${n}`).toBeLessThan(0.58);
    }
  });

  it("draws the full grid from 96 px, as §A.3 asks for documents; each level from three quarters of its size", () => {
    expect([12, 16, 23, 24, 32, 47, 48, 64, 95, 96, 128, 160].map((size) => levelFor(size).n)).toEqual([2, 2, 2, 4, 4, 4, 8, 8, 8, 16, 16, 16]);
    expect(() => levelFor(0)).toThrow(/positive size/);
    expect(() => levelFor(Number.NaN)).toThrow(/positive size/);
  });

  it("draws a standalone SVG for print at the 64 px level, in the caller's inks, the same paths as on screen (L1-071)", () => {
    const inks = { frame: PAPER_INKS.text, cells: PAPER_INKS.text };
    const svg = fingerprintMarkSvg(EMPTY, inks);
    const g = fingerprintMark(EMPTY, PRINT_LEVEL);
    expect(svg).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><path d="${g.frame}" fill="none" stroke="${PAPER_INKS.text}" stroke-width="1.25" stroke-linejoin="miter"/><path d="${g.cells}" fill="${PAPER_INKS.text}"/></svg>`,
    );
    expect(fingerprintMarkSvg(EMPTY, inks)).toBe(svg);
    expect(fingerprintMarkSvg(EMPTY, inks, 16)).not.toContain('fill="#');
    expect(() => fingerprintMarkSvg(EMPTY, { frame: "red", cells: PAPER_INKS.text })).toThrow(/hexadecimal/);
  });

  it("weighs little: two paths, the 128 px mark under 1.5 KB compressed", () => {
    for (const hex of [EMPTY, sha("a"), sha("b")]) {
      const markup = html({ lang: "fr", fingerprint: hex, size: 128 });
      expect(markup.match(/<path/g)).toHaveLength(2);
      expect(gzipSync(markup).length).toBeLessThan(1536);
    }
  });
});

describe("the component", () => {
  // The sentence of the concept (§D.2, Régl. §3.6): it never lets one believe in a qualified signature.
  const SENTENCE = "Signé électroniquement sur Proofseen par les deux parties le 24 octobre 2026";
  const sealed = { kind: "sealed", sentence: SENTENCE, date: "2026-10-24" } as const;

  it("is an image named by the fingerprint and the state, in words", () => {
    const out = html({ lang: "fr", fingerprint: EMPTY, size: 16 });
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="Empreinte du document, E3B0 C442 98FC 1C14. Déposé"');
    expect(out).toContain('data-state="filed"');
    expect(out).toContain('focusable="false"');
    expect(fingerprintLabel({ lang: "en", fingerprint: EMPTY, subject: "of the contract, version 3", state: { kind: "pending", word: "To sign", due: "2026-11-07" } })).toBe(
      "Fingerprint of the contract, version 3, E3B0 C442 98FC 1C14. To sign, due on 7 November 2026",
    );
    expect(fingerprintLabel({ lang: "fr", fingerprint: EMPTY, state: sealed })).toBe(`Empreinte du document, E3B0 C442 98FC 1C14. ${SENTENCE}`);
  });

  it("draws at the rendered size with the geometry of its level", () => {
    const out = html({ lang: "fr", fingerprint: EMPTY, size: 96 });
    expect(out).toContain('viewBox="0 0 128 128"');
    expect(out).toContain('width="96"');
    expect(out).toContain('data-level="128"');
    // A closed frame carries no dash at all.
    expect(out).not.toContain("stroke-dasharray");
  });

  it("refuses a sealed state that cannot say when, a pending state without its word, a fingerprint that is not one", () => {
    expect(() => html({ lang: "fr", fingerprint: EMPTY, state: { kind: "sealed", sentence: "Signé", date: "bientôt" } })).toThrow(/real date/);
    expect(() => html({ lang: "fr", fingerprint: EMPTY, state: { kind: "sealed", sentence: " ", date: "2026-10-24" } })).toThrow();
    expect(() => html({ lang: "fr", fingerprint: EMPTY, state: { kind: "pending", word: "" } })).toThrow();
    expect(() => html({ lang: "fr", fingerprint: "7F3A 91C2 0B4E D2A8" })).toThrow(/64 hexadecimal/);
  });

  it("as a stamp, writes what attests: the sixteen characters, the state in words, the date in its <time>", () => {
    const out = html({ lang: "fr", fingerprint: EMPTY, size: 16, state: sealed }, true);
    expect(out).toContain('aria-hidden="true"');
    expect(out).not.toContain('role="img"');
    expect(out).toContain('<span class="sr-only">Empreinte du document</span>');
    expect(out).toContain('<code class="ui-fp-code">E3B0 C442 98FC 1C14</code>');
    expect(out).toContain(`<time class="ui-fp-word" dateTime="2026-10-24">${SENTENCE}</time>`);
    const pending = html({ lang: "fr", fingerprint: EMPTY, state: { kind: "pending", word: "À signer", due: "2026-11-07" } }, true);
    expect(pending).toContain('<time dateTime="2026-11-07">7 novembre 2026</time>');
    expect(html({ lang: "en", fingerprint: EMPTY }, true)).toContain('<span class="ui-fp-word">Filed</span>');
  });

  it("is drawn by the server: no script in the mark or its geometry, which lives in the brand without any dependency", () => {
    const geometry = readFileSync(join(src, "..", "..", "..", "packages", "brand", "src", "fingerprint-mark.ts"), "utf8");
    for (const code of [readFileSync(join(src, "components/ui/fingerprint/FingerprintMark.tsx"), "utf8"), geometry]) {
      expect(code).not.toMatch(/^["']use client["']/m);
    }
    // Importable from any package (the document engine prints it): no import at all, so no DOM and no zod.
    expect(geometry).not.toMatch(/^import /m);
    expect(existsSync(join(src, "lib", "fingerprint-mark.ts"))).toBe(false);
  });
});

describe("green is earned (§A.5)", () => {
  const filesUnder = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? filesUnder(path) : [path];
    });

  it("reads the proof colour only in the rules of a sealed mark", () => {
    const css = readFileSync(join(src, "styles", "ui.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const green = (css.match(/[^{}]+\{[^}]*var\(--ps-(?:proof|on-proof|halo-proof|glow-proof)[^}]*\}/g) ?? []).map((rule) => (rule.split("{")[0] ?? "").trim());
    expect(green.length).toBeGreaterThan(0);
    for (const selector of green) expect(selector).toContain('[data-state="sealed"]');
  });

  it("builds a sealed mark only in a file of the one list of green (L1-090, point 3), the list seal.test.ts asserts", () => {
    const sealing = filesUnder(src)
      .filter((f) => /\.tsx?$/.test(f) && /kind:\s*["']sealed["']|kind=["']sealed["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(src, f).replace(/\\/g, "/"));
    // The list is imported, never copied: a screen that strikes the fingerprint and is missing from it fails here.
    for (const file of sealing) expect(GREEN_FILES, file).toContain(file);
    // And seal.test.ts sees the same files: its detection includes the sealed fingerprint.
    expect(STRIKES_GREEN.test('state={{ kind: "sealed", sentence, date }}')).toBe(true);
    expect(STRIKES_GREEN.test('import { Seal } from "@/components/proof/Seal";')).toBe(true);
    // L1 ships the primitive and no screen that strikes it.
    expect(sealing).toEqual([]);
  });
});
