import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WaveView } from "@proofseen/db";
import { CitationRegister } from "../src/components/visibility/CitationRegister";
import { visibilityEn } from "../src/i18n/market/visibility-en";
import { visibilityFr } from "../src/i18n/market/visibility-fr";
import { citationRegister, engineColumn } from "../src/lib/citation-register";

/*
 * Lot 2 of the connected redesign, "être cité" (CONNECTED_PLAN §2.1 and decision 1 of §6): the latest measurement as a
 * register of the person's own answers, one slot per answer obtained, green where an answer cites them with a link, the
 * count always raw and dated, never a share alone.
 */

const wave = (engines: WaveView["engines"]): WaveView => ({ waveId: "w-1", measuredAt: new Date("2026-10-03T08:00:00Z"), draws: engines.reduce((s, e) => s + e.draws, 0), engines });
const engine = (name: string, draws: number, cited: number) => ({ engine: name, draws, retrieved: 0, named: 0, top5: 0, cited });
const html = (w: WaveView, lang: "fr" | "en" = "fr"): string =>
  renderToStaticMarkup(createElement(CitationRegister, { lang, v: lang === "fr" ? visibilityFr : visibilityEn, wave: w })).replace(/&#x27;/g, "'");

/** The slots a dashed path draws: each `h<len>` run of slots of 4 with gaps of 1 holds (len + 1) / 5 slots. */
const slots = (d: string): number => [...d.matchAll(/h(\d+(?:\.\d+)?)/g)].reduce((sum, m) => sum + (Number(m[1]) + 1) / 5, 0);

describe("the register of the answers, as numbers", () => {
  it("draws one slot per answer, the cited ones first, rows of twenty", () => {
    const column = engineColumn({ engine: "openai", draws: 45, cited: 3 });
    expect(slots(column.citedPath)).toBe(3);
    expect(slots(column.restPath)).toBe(42);
    // Three rows (20, 20, 5); the cited run opens the first row, at its left edge.
    expect(column.citedPath).toMatch(/^M0 /);
    expect(column.restPath.match(/M/g)).toHaveLength(3);
  });

  it("lights nothing at zero, and never counts more cited answers than answers", () => {
    expect(engineColumn({ engine: "anthropic", draws: 260, cited: 0 }).citedPath).toBe("");
    const clamped = engineColumn({ engine: "x", draws: 4, cited: 9 });
    expect(clamped.cited).toBe(4);
    expect(slots(clamped.restPath)).toBe(0);
    expect(engineColumn({ engine: "y", draws: -3, cited: 1.7 })).toMatchObject({ draws: 0, cited: 0, citedPath: "", restPath: "" });
  });

  it("totals the raw counts of every engine", () => {
    expect(citationRegister([engineColumn({ engine: "a", draws: 260, cited: 0 }), { engine: "b", draws: 260, cited: 2 }])).toMatchObject({ draws: 520, cited: 2 });
  });

  it("lets the reading rule rest on the foot rule, and rise to the head rule", () => {
    const column = engineColumn({ engine: "openai", draws: 40, cited: 0 });
    const foot = Number(/M0 1h99M0 ([\d.]+)h99/.exec(column.frame)?.[1]);
    expect(column.rule.startsWith(`M-3 ${foot}h`)).toBe(true);
    expect(column.rise).toBe(1 - foot);
  });
});

describe("the register of the answers, as the server sends it", () => {
  it("at zero, writes n of N and its date, lights no slot and says so", () => {
    const out = html(wave([engine("openai", 260, 0), engine("anthropic", 260, 0), engine("perplexity", 260, 0)]));
    expect(out).toContain("Réponses qui vous citent avec un lien\u202f: 0 sur 780. Mesure du 3 octobre 2026.");
    expect(out).toContain("0 sur 260");
    expect(out).not.toContain("cr-cited");
    expect(out).toContain(visibilityFr.register.none);
    // A raw count, never a share alone.
    expect(out).not.toMatch(/\d\s*%/);
  });

  it("inks the cited answers in green, and names each column for a screen reader", () => {
    const out = html(wave([engine("openai", 260, 2), engine("perplexity", 120, 0)]), "en");
    expect(out.match(/class="cr-cited"/g)).toHaveLength(1);
    expect(out).toContain('aria-label="OpenAI: 2 answers cited with a link out of 260"');
    expect(out).toContain("Answers that cite you with a link: 2 of 380.");
    expect(out).not.toContain(visibilityEn.register.none);
    // The same counts in words, in a table folded under the figure.
    expect(out).toMatch(/<details class="cr-table"><summary>The register as a table<\/summary>/);
    expect(out).toMatch(/<tfoot><tr><th scope="row">Total<\/th><td class="num num-col">380<\/td><td class="num num-col">2<\/td>/);
  });

  it("says an engine that gave no answer instead of drawing an empty column", () => {
    const out = html(wave([engine("openai", 0, 0)]));
    expect(out).toContain(visibilityFr.latest.noAnswer);
    expect(out).not.toContain("<svg");
  });

  it("moves only under no-preference, once, and starts from a visible rule", () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "styles", "app-registre.css"), "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{\s*\.cr-rule \{ animation: cr-descend 1200ms [^;]* both; \}/);
    expect(css).not.toMatch(/infinite/);
  });
});
