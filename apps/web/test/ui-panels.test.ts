import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio, mix, PALETTE } from "@proofseen/brand";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Inspector } from "../src/components/ui/inspector/Inspector";
import { closeInspectorHref, inspectedId, inspectHref } from "../src/components/ui/inspector/inspector-url";
import { KpiGrid, KpiTile, MeasuredAt, type KpiTileProps } from "../src/components/ui/kpi/KpiTile";
import { Timeline, type TimelineProps } from "../src/components/ui/timeline/Timeline";
import { waited, writtenDate } from "../src/components/ui/when";

/*
 * The detail primitives of the Tower (LEGENDS_P2_CONCEPT §B.4, §B.7, §C.0): Inspector, Timeline, KpiTile; the measured
 * contrasts of the controls (L1-091 K3, K16); and the rules every file of components/ui keeps. Example data only.
 */

const NARROW = String.fromCharCode(0x202f);
const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const ui = join(src, "components", "ui");
const css = readFileSync(join(src, "styles", "ui.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
const rel = (path: string): string => relative(src, path).replace(/\\/g, "/");

describe("Inspector", () => {
  it("lives in the address: ?voir= opens it on an identifier, its absence closes it, the rest of the view stays", () => {
    expect(inspectedId({ voir: "ckx9-a_1" })).toBe("ckx9-a_1");
    for (const bad of ["../etc", "a b", "<b>", "x".repeat(65), ""]) expect(inspectedId({ voir: bad }), bad).toBeNull();
    expect(inspectHref("/fr/app/operateur", { tri: "-age", page: "2" }, "b2")).toBe("/fr/app/operateur?tri=-age&page=2&voir=b2");
    expect(closeInspectorHref("/fr/app/operateur", { tri: "-age", voir: "b2" })).toBe("/fr/app/operateur?tri=-age");
    expect(() => inspectHref("/p", {}, "a b")).toThrow(/identifier/);
  });

  it("is a complementary landmark named by its h2, which can take the focus, with a close link to the same view", () => {
    const html = renderToStaticMarkup(
      createElement(Inspector, { lang: "fr", id: "insp-b2", title: "Attestation de FR-EX002", meta: "Attestations, en attente", closeHref: "/fr/app/operateur?tri=-age", actions: "Décider" }, "Les faits"),
    );
    expect(html).toContain('<aside class="ui-inspector" aria-labelledby="insp-b2-title">');
    expect(html).toContain('<h2 id="insp-b2-title" tabindex="-1">Attestation de FR-EX002</h2>');
    expect(html).toContain('<a id="insp-b2-close" class="ui-inspector-close" href="/fr/app/operateur?tri=-age">Fermer<span class="sr-only"> le panneau de détail</span></a>');
    // The decisions come right under the title, before the facts (K10).
    expect(html).toContain('</header><div class="ui-inspector-actions">Décider</div><div class="ui-inspector-body">Les faits</div>');
    // The island draws nothing: without JavaScript the panel is whole.
    expect(html).not.toContain("<script");
    expect(() => renderToStaticMarkup(createElement(Inspector, { lang: "fr", id: "x", title: " ", closeHref: "/p" }, "x"))).toThrow(/title/);
  });

  it("dresses a decision that undoes in the danger colour, and opens its reason before it acts (K10)", () => {
    expect(css).toMatch(/\.btn\.ui-danger \{ color: var\(--ps-danger\); border-color: var\(--ps-danger\); \}/);
    expect(css).toMatch(/\.ui-confirm\[open\] \{/);
  });

  it("keeps its island small and careful: focus after an action only, Escape never while a field or a dialog holds it", () => {
    const island = readFileSync(join(ui, "inspector", "InspectorKeys.tsx"), "utf8");
    expect(island.startsWith('"use client";')).toBe(true);
    expect(island).toContain("active !== document.body");
    expect(island).toContain('document.querySelector("dialog[open]")');
    expect(island).toContain("event.defaultPrevented");
    expect(island).toContain("removeEventListener");
    // Budget §C.2: 2 KB compressed; the source itself stays well under it.
    expect(island.replace(/\/\*[\s\S]*?\*\//g, "").length).toBeLessThan(1200);
  });
});

describe("Timeline", () => {
  const events: TimelineProps["events"] = [
    { id: "e2", at: "2026-10-24T12:03:00Z", title: "Attestation vérifiée", actor: "Opérateur", detail: "Code de sécurité contrôlé" },
    { id: "e1", at: "2026-10-22T07:30:00Z", title: "Attestation déposée", actor: "Freelance" },
    { id: "e3", at: "2026-10-24T12:03:00Z", title: "Enveloppe", status: { word: "Expirée", tone: "danger" }, href: "/fr/app/operateur?voir=e3" },
  ];
  const draw = (props: Partial<TimelineProps> = {}): string =>
    renderToStaticMarkup(createElement(Timeline, { lang: "fr", label: "Historique de l'attestation", events, ...props }));

  it("lists the events in the order they happened, each with its real date in a <time>, read in Paris", () => {
    const html = draw();
    expect(html).toContain('<ol class="ui-tl" aria-label="Historique de l&#x27;attestation">');
    expect([...html.matchAll(/<p class="ui-tl-title">(?:<span[^>]*>[^<]*<\/span>)?(?:<a[^>]*>)?([^<]+)/g)].map((m) => m[1])).toEqual(["Attestation déposée", "Attestation vérifiée", "Enveloppe"]);
    expect(html).toContain(`<time class="ui-tl-time" dateTime="2026-10-24T12:03:00Z">24 octobre 2026 à 14:03</time>`);
    expect(html).toContain('<p class="ui-tl-meta">Opérateur · Code de sécurité contrôlé</p>');
  });

  it("says a state with its own word and tone, never a generic one: an expired envelope is « Expirée », in danger (K9)", () => {
    const html = draw();
    expect(html).toContain('<li class="ui-tl-item" data-tone="danger">');
    expect(html).toContain('<span class="ui-tl-status">Expirée </span><a href="/fr/app/operateur?voir=e3">Enveloppe</a>');
    expect(html).not.toMatch(/En attente|Alerte/);
    expect(() => draw({ events: [{ id: "x", at: "2026-10-24", title: "Relance", status: { word: " ", tone: "signal" } }] })).toThrow();
  });

  it("can read as a journal, newest first, or by the day only", () => {
    const html = draw({ order: "newest-first", precision: "day" });
    expect(html.indexOf("Attestation déposée")).toBeGreaterThan(html.indexOf("Enveloppe"));
    expect(html).toContain('<time class="ui-tl-time" dateTime="2026-10-22">22 octobre 2026</time>');
  });

  it("never places a step at a date the database does not hold: it is to come, in words", () => {
    const html = draw({ upcoming: [{ id: "u1", title: "Versement au freelance", when: "à la validation du client" }] });
    expect(html).toContain('<ol class="ui-tl ui-tl-upcoming" aria-label="Historique de l&#x27;attestation, à venir">');
    expect(html).toContain('<li class="ui-tl-item" data-tone="upcoming"><span class="ui-tl-time">à la validation du client</span><p class="ui-tl-title">Versement au freelance</p></li>');
    expect(() => draw({ events: [{ id: "x", at: "bientôt", title: "?" }] })).toThrow(/real date/);
  });

  it("writes dates and waits the French way, short and with narrow no-break spaces (K1)", () => {
    expect(writtenDate(new Date("2026-01-05T23:30:00Z"), "fr", "day")).toBe("6 janvier 2026");
    expect(writtenDate(new Date("2026-10-24T12:03:00Z"), "en", "minute")).toBe("24 October 2026 at 14:03");
    const at = new Date("2026-10-24T12:00:00Z");
    expect(waited(new Date("2026-10-24T11:48:00Z"), at, "fr")).toBe(`12${NARROW}min`);
    expect(waited(new Date("2026-10-24T07:00:00Z"), at, "fr")).toBe(`5${NARROW}h`);
    expect(waited(new Date("2026-10-21T08:00:00Z"), at, "fr")).toBe(`3${NARROW}j`);
    expect(waited(new Date("2026-10-21T08:00:00Z"), at, "en")).toBe(`3${NARROW}d`);
    expect(waited(new Date("2026-10-25T08:00:00Z"), at, "fr")).toBe(`0${NARROW}min`);
  });
});

describe("KpiTile", () => {
  const base: KpiTileProps = {
    lang: "fr",
    label: "Attestations",
    value: 12,
    definition: "Attestations URSSAF déclarées qu'aucun opérateur n'a encore vérifiées.",
    measuredAt: "2026-10-24T07:42:00Z",
  };
  const tile = (props: Partial<KpiTileProps> = {}): string => renderToStaticMarkup(createElement(KpiTile, { ...base, ...props }));

  it("leads with what decides: the late mark at the top, the count with its word, the oldest wait on its line (K5, R2)", () => {
    const html = tile({ href: "/fr/app/operateur/files/attestations", oldestSince: "2026-10-21T07:00:00Z", overdue: 2 });
    expect(html).toContain(
      '<div class="ui-kpi" data-link=""><div class="ui-kpi-head"><h3 class="ui-kpi-label"><a href="/fr/app/operateur/files/attestations">Attestations</a></h3><p class="ui-kpi-late">2 en retard</p></div>',
    );
    // « 12 en attente », then « la plus ancienne : 3 j » on its own line: never « 12 plus ancienne » as one phrase.
    expect(html).toContain(`<p class="ui-kpi-figure"><data class="ui-kpi-value" value="12">12</data> en attente</p><p class="ui-kpi-oldest"><span class="ui-kpi-oldest-k">la plus ancienne${NARROW}: </span><span class="ui-kpi-oldest-v">3${NARROW}j</span></p>`);
    expect(tile({ unit: "à vérifier" })).toContain("</data> à vérifier</p>");
    expect(() => tile({ unit: "de score" })).toThrow(/never ranks people/);
    expect(html).toContain('<time dateTime="2026-10-24T07:42:00Z">Mesuré le 24 octobre 2026 à 09:42</time>');
    expect(css).toMatch(/\.ui-kpi-value \{ font: var\(--ps-weight-display\) var\(--ps-step-3\)/);
  });

  it("keeps the place of the late mark in every tile, so a late queue does not sit lower than its neighbours (R2)", () => {
    expect(css).toMatch(/\.ui-kpi-head \{[^}]*min-height: 1\.5rem;/);
    expect(css).toMatch(/\.ui-kpi-late \{[^}]*height: 1\.5rem;/);
    // On a phone, label and mark on two lines, reserved in every tile.
    expect(css).toMatch(/@media \(max-width: 47\.99rem\) \{[^@]*\.ui-kpi-head \{ flex-direction: column;[^}]*min-height: calc\(/);
  });

  it("goes quiet at zero, and shows nothing it does not hold: no age, no lateness, no trend", () => {
    const html = tile({ value: 0, overdue: 0, oldestSince: "2026-10-21T07:00:00Z" });
    expect(html).toContain('<div class="ui-kpi" data-zero="">');
    expect(html).toContain('<data class="ui-kpi-value" value="0">0</data> en attente</p>');
    expect(html).not.toMatch(/ui-kpi-late|ui-kpi-oldest|data-link/);
    expect(html).not.toMatch(/tendance|trend|%/i);
    expect(css).toMatch(/\.ui-kpi\[data-zero\] :is\(\.ui-kpi-label, \.ui-kpi-value\) \{ color: var\(--ps-muted\); \}/);
  });

  it("says once when a row of tiles was measured, under the page title, not on every tile (K5)", () => {
    const grid = renderToStaticMarkup(
      createElement(KpiGrid, {
        lang: "fr",
        label: "Files de revue",
        measuredAt: "2026-10-24T07:42:00Z",
        tiles: [
          { label: "Signatures", value: 1, definition: "Enveloppes bloquées." },
          { label: "Modération", value: 0, definition: "Contenus signalés." },
        ],
      }),
    );
    expect(grid).toContain('<ul class="ui-kpis" aria-label="Files de revue"><li>');
    expect(grid.match(/<li>/g)).toHaveLength(2);
    expect(grid).not.toContain("Mesuré");
    expect(renderToStaticMarkup(createElement(MeasuredAt, { lang: "fr", at: "2026-10-24T07:42:00Z" }))).toBe(
      '<p class="ui-measured"><time dateTime="2026-10-24T07:42:00Z">Mesuré le 24 octobre 2026 à 09:42</time></p>',
    );
  });

  it("refuses what it cannot vouch for: a fraction, a negative count, a date that is not one, a ranking of people", () => {
    expect(() => tile({ value: 1.5 })).toThrow();
    expect(() => tile({ value: -1 })).toThrow();
    expect(() => tile({ measuredAt: "hier" })).toThrow(/real date/);
    expect(() => tile({ label: "Score moyen des freelances" })).toThrow(/never ranks people/);
    expect(() => tile({ definition: "Le classement des apporteurs." })).toThrow(/never ranks people/);
  });

  it("writes large counts with the narrow no-break space of French typography", () => {
    expect(tile({ value: 1234 })).toContain(`<data class="ui-kpi-value" value="1234">1${NARROW}234</data>`);
  });

  it("sets the tiles two by two on a phone, so the queue stays in sight (K11)", () => {
    expect(css).toMatch(/@media \(max-width: 47\.99rem\) \{\s*\.ui-kpis \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  });
});

describe("contrasts of the controls, measured (WCAG 2.x, the brand's contrastRatio)", () => {
  const p = PALETTE.dark;
  // The grounds a checkbox sits on: the table's surface, a row under the pointer (7 % of aura), the current row (12 %).
  const grounds = { surface: p.surface, hover: mix(p.surface, p.aura, 0.07), current: mix(p.surface, p.aura, 0.12) };

  it("draws the edge of an empty checkbox at 3:1 at least on every ground of its row (1.4.11, K3)", () => {
    const ratios = Object.fromEntries(Object.entries(grounds).map(([name, ground]) => [name, Number(contrastRatio(p.lineStrong, ground).toFixed(2))]));
    expect(ratios).toEqual({ surface: 4.12, hover: 3.85, current: 3.61 });
    for (const ratio of Object.values(ratios)) expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it("draws a checked box and its tick at 3:1 at least: the violet on every ground, the ink tick on the violet (K3)", () => {
    for (const ground of Object.values(grounds)) expect(contrastRatio(p.aura, ground)).toBeGreaterThanOrEqual(3);
    expect(Number(contrastRatio(p.text, p.aura).toFixed(2))).toBe(3.36);
  });

  it("writes the hint under a field at 4.5:1 at least (1.4.3, K16)", () => {
    expect(Number(contrastRatio(p.muted, p.bg).toFixed(2))).toBe(9.18);
    expect(Number(contrastRatio(p.muted, p.surface).toFixed(2))).toBe(8.67);
  });

  it("writes the danger of a decision and the late mark at 4.5:1 at least on their grounds", () => {
    expect(contrastRatio(p.danger, mix(p.surface, p.danger, 0.12))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.signal, mix(p.surface, p.signal, 0.12))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the rules of components/ui", () => {
  const files = filesUnder(ui).filter((f) => /\.tsx?$/.test(f));

  it("draws on the server: the inspector's keys are the only client island", () => {
    expect(files.filter((f) => /^["']use client["']/m.test(readFileSync(f, "utf8"))).map(rel)).toEqual(["components/ui/inspector/InspectorKeys.tsx"]);
  });

  it("dresses every component from the one sheet of the primitives", () => {
    const components = files.filter((f) => f.endsWith(".tsx") && !f.endsWith("InspectorKeys.tsx"));
    expect(components.map(rel).sort()).toEqual([
      "components/ui/filter/FilterBar.tsx",
      "components/ui/fingerprint/FingerprintMark.tsx",
      "components/ui/inspector/Inspector.tsx",
      "components/ui/kpi/KpiTile.tsx",
      "components/ui/table/DataTable.tsx",
      "components/ui/timeline/Timeline.tsx",
    ]);
    for (const file of components) expect(readFileSync(file, "utf8"), rel(file)).toContain('import "@/styles/ui.css";');
  });

  it("keeps every file under 400 lines, and the sheet free of motion", () => {
    for (const file of files) expect(readFileSync(file, "utf8").split("\n").length, rel(file)).toBeLessThan(400);
    expect(css).not.toMatch(/@keyframes|animation\s*:/);
  });

  it("keeps capitals in the trace face for column headers and section labels only (K18)", () => {
    const uppercase = [...css.matchAll(/([^{}]+)\{[^}]*text-transform: uppercase[^}]*\}/g)].map((m) => (m[1] ?? "").trim());
    expect(uppercase).toEqual([".ui-table thead th", ".ui-tl-upcoming-label"]);
  });

  it("gives every grid a column that may shrink, so no primitive pushes a phone page wider than 375 px", () => {
    const shrinkable = new Set((/:is\(([^)]*)\)\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/.exec(css)?.[1] ?? "").split(",").map((s) => s.trim()));
    const grids = [...css.matchAll(/([^{}]+)\{([^}]*display:\s*grid[^}]*)\}/g)].filter((m) => !/grid-template-columns/.test(m[2] ?? ""));
    for (const [, selector] of grids) expect(shrinkable, (selector ?? "").trim()).toContain((selector ?? "").trim());
  });

  it("writes no emoji in any string of the primitives", () => {
    for (const file of files) expect(readFileSync(file, "utf8"), rel(file)).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
