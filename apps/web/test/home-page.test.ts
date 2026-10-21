import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import LandingPage, { generateMetadata } from "../src/app/[lang]/page";
import { J0_CITATIONS, SHOWN_SHARES } from "../src/data/j0-citations";
import { AnswersSnapshotSchema } from "../src/data/schema";
import { en } from "../src/i18n/en";
import { fr } from "../src/i18n/fr";
import { buildRegistre } from "../src/lib/registre";

/*
 * Lot b of the redesign: the storefront as the server sends it. The page is rendered to static HTML (what a robot, a
 * reader without JavaScript or a full-page capture receives) and checked for what it must and must never carry.
 */

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = AnswersSnapshotSchema.parse(JSON.parse(readFileSync(join(web, "data", "j0-answers.json"), "utf8")));
const styles = readFileSync(join(web, "src", "styles", "home.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// The server reads apps/web/data relative to its working directory; here the same file is handed over directly.
vi.mock("../src/data/file-source", async () => {
  const { readFile } = await import("node:fs/promises");
  const file = new URL("../data/j0-answers.json", import.meta.url);
  return { getSource: () => ({ answers: async () => JSON.parse(await readFile(file, "utf8")) as unknown }) };
});

// Outside the Next router there is no current path: the language switch of the header reads the home page's.
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), usePathname: () => "/fr" }));

const home: Record<"fr" | "en", string> = { fr: "", en: "" };

beforeAll(async () => {
  for (const lang of ["fr", "en"] as const) {
    home[lang] = renderToStaticMarkup(await LandingPage({ params: Promise.resolve({ lang }) }));
  }
});

const visibleText = (html: string): string =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("the storefront carries no price (decision of 2026-10-07)", () => {
  it.each(["fr", "en"] as const)("%s: no euro amount, no offer, no order page", (lang) => {
    const html = home[lang];
    expect(html).not.toMatch(/€|EUR\b/);
    expect(visibleText(html)).not.toMatch(/\b(?:prix|tarifs?|price|pricing|paiement unique|one-off payment)\b/i);
    expect(html).not.toContain(`/${lang}/commande`);
    expect(html).not.toMatch(/class="offers?\b/);
  });

  it("keeps no offer copy in the dictionaries of the home page", () => {
    expect("offers" in fr).toBe(false);
    expect("offers" in en).toBe(false);
  });
});

describe("every section is in the server HTML, visible without waiting for a script", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ] as const)("%s: the five steps are written in full", (lang, t) => {
    const text = visibleText(home[lang]);
    for (const stage of t.method.stages) {
      expect(text).toContain(stage.code);
      expect(text).toContain(stage.name);
      expect(text).toContain(stage.question);
    }
    expect(text).toContain(t.method.diagramNote);
  });

  it("renders every section of the storyboard, in order", () => {
    const ids = [...home.fr.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["mesure", "preuve", "trajet", "methode", "livrable", "entreprises", "charte", "faq"]);
    expect(home.fr).toContain('aria-labelledby="hero-title"');
    expect(home.fr).toContain('aria-labelledby="exit-title"');
  });

  it("labels the specimen as fictitious, in both languages", () => {
    expect(visibleText(home.fr)).toContain("Spécimen. Exemple illustratif, données fictives.");
    expect(visibleText(home.en)).toContain("Specimen. Illustrative example, fictitious data.");
  });

  it("hides nothing behind a reveal: no observer wrapper, no armed state, no content-visibility", () => {
    expect(home.fr).not.toMatch(/data-armed|data-in\b/);
    expect(styles).not.toMatch(/content-visibility/);
    expect(styles).not.toMatch(/data-armed/);
    // The only opacity at zero allowed is the replay of the simulator, which starts from its visible final state.
    const zero = [...styles.matchAll(/([^{}]+)\{[^}]*opacity:\s*0(?![.\d])/g)].map((m) => (m[1] ?? "").trim());
    expect(zero).toEqual([".sim[data-playing] [data-reveal]:not(.is-in)"]);
  });

  it("waits for a signature gesture only where a script will start it, and never under reduced motion", () => {
    // Walk the blocks: every rule about the play state sits inside that one media query.
    const stack: string[] = [];
    const found: string[] = [];
    let prelude = "";
    for (const char of styles) {
      if (char === "{") {
        const head = prelude.trim();
        if (/data-play\]/.test(head)) found.push(stack.join(" | "));
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
    expect(found.length).toBe(6);
    for (const context of found) expect(context).toBe("@media (scripting: enabled) and (prefers-reduced-motion: no-preference)");
  });
});

describe("the register of the 780 answers is server SVG, under budget", () => {

  it("is one inline SVG of the real answers, with no answer object sent to the client", () => {
    const figure = home.fr.match(/<svg class="rg-svg"[\s\S]*?<\/svg>/)?.[0] ?? "";
    expect(figure).not.toBe("");
    // 6 categories present, the frame, three reading rules: one path each.
    expect((figure.match(/<path/g) ?? []).length).toBeLessThanOrEqual(10);
    expect(Buffer.byteLength(figure)).toBeLessThan(8 * 1024);
    expect(home.fr).not.toMatch(/"control"|"domains"/);
  });

  it("counts every answer once, per engine and per source", () => {
    const registre = buildRegistre(snapshot.answers, snapshot.engines.length);
    const total = registre.counts.reduce((sum, engine) => sum + Object.values(engine).reduce((a, b) => a + b, 0), 0);
    expect(total).toBe(snapshot.answers.length);
    expect(registre.targets + registre.controls).toBe(new Set(snapshot.answers.map((a) => a.offer)).size);
    // The dash pattern draws one slot per answer: the runs of each row add up to 20 slots per row and engine.
    const slots = registre.paths.flatMap((p) => [...p.d.matchAll(/h(\d+)/g)].map((m) => (Number(m[1]) + 1) / 5));
    expect(slots.reduce((a, b) => a + b, 0)).toBe(snapshot.answers.length);
  });

  it("writes the founder's line from the data: no slot is green", () => {
    expect(visibleText(home.fr)).toContain("Notre fondateur : cité 0 fois sur 780");
    expect(visibleText(home.en)).toContain("Our founder: cited 0 times out of 780");
    expect(home.fr).not.toContain("rg-cat rg-you");
  });

  it("offers the same tally as a table, and a filter that works without script", () => {
    expect(home.fr).toMatch(/<details class="rg-table"><summary>Lire le relevé en tableau<\/summary>/);
    expect((home.fr.match(/<input[^>]*type="radio"[^>]*name="rg-source"/g) ?? []).length).toBe(7);
  });
});

describe("the simulator replays the founder's measure and says so (Kensa M1)", () => {
  it.each([
    ["fr", "Notre fondateur : absent de cette réponse", "Notre fondateur apparaît"],
    ["en", "Our founder: not in this answer", "Our founder appears"],
  ] as const)("%s: names the founder, never the visitor", (lang, verdict, appear) => {
    const sim = visibleText(home[lang].match(/<figure class="sim"[\s\S]*?<\/figure>/)?.[0] ?? "");
    expect(sim).toContain(verdict);
    expect(sim).toContain(appear);
    // "votre recherche" is the engine speaking to the recruiter; the reading of the count never says "you".
    expect(sim).not.toMatch(/\bVous\s*:|\bVous apparaissez|\bYou\s*:|\bYou appear/);
  });

  it("reads the same sentence to a screen reader, with the colon of each language", () => {
    expect(home.fr).toContain('<p class="sr-only">Notre fondateur apparaît 0 fois sur 200. Fourchette du taux réel : [');
    expect(home.en).toContain('<p class="sr-only">Our founder appears 0 times out of 200. Range of the true rate: [');
  });
});

describe("every citation share carries its raw count, its total and its wave (Kensa M2)", () => {
  it.each([
    ["fr", "Part des 2 328 citations relevées dans les 780 réponses, par domaine. Vague J0, 23 et 24 septembre 2026.", ["malt.fr 39 % 908 citations sur 2 328", "linkedin.com 26,5 % 618 citations sur 2 328", "github.com 2,9 % 67 citations sur 2 328"]],
    ["en", "Share of the 2,328 citations found in the 780 answers, by domain. Wave J0, 23 and 24 September 2026.", ["malt.fr 39% 908 of 2,328 citations", "linkedin.com 26.5% 618 of 2,328 citations", "github.com 2.9% 67 of 2,328 citations"]],
  ] as const)("%s: no share without its count", (lang, caption, rows) => {
    const figure = home[lang].match(/<figure class="study-shares">[\s\S]*?<\/figure>/)?.[0] ?? "";
    const text = visibleText(figure).trim();
    expect(text).toContain(caption);
    for (const row of rows) expect(text).toContain(row);
    // As many raw counts as percentages: a share never stands alone.
    expect((text.match(/%/g) ?? []).length).toBe(SHOWN_SHARES.length);
  });

  it("holds the fixed counts against the answers snapshot of the same wave", () => {
    expect(snapshot.waveId).toBe("J0");
    expect(J0_CITATIONS.answers).toBe(snapshot.answers.length);
    // The other citations are kept per answer in the snapshot: they add up to the same number.
    expect(snapshot.answers.reduce((sum, a) => sum + a.other, 0)).toBe(J0_CITATIONS.other);
    const platforms = Object.values(J0_CITATIONS.platforms).reduce((a, b) => a + b, 0);
    expect(platforms + J0_CITATIONS.other).toBe(J0_CITATIONS.total);
    // Every platform cited in an answer is listed, and none is counted fewer times than the answers that cite it.
    const answersCiting = new Map<string, number>();
    for (const a of snapshot.answers) for (const d of a.domains) answersCiting.set(d, (answersCiting.get(d) ?? 0) + 1);
    expect([...answersCiting.keys()].sort()).toEqual(Object.keys(J0_CITATIONS.platforms).sort());
    for (const [domain, n] of answersCiting) expect(J0_CITATIONS.platforms[domain as keyof typeof J0_CITATIONS.platforms]).toBeGreaterThanOrEqual(n);
  });
});

describe("the register never widens the page on a phone (Kensa B1)", () => {
  // The first top-level rule of a selector (a rule inside a media query follows a "{", not a "}").
  const rule = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(styles)?.[1] ?? "";
  };

  it("gives the opening grid and the register one track that may shrink below the table's width", () => {
    // Without it the implicit track takes the min-content width of the open table (418 px), and the page scrolls at 375.
    for (const grid of [".hero-grid", ".registre"]) {
      expect(rule(grid), grid).toMatch(/display:\s*grid/);
      expect(rule(grid), grid).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    }
    expect(rule(".rg-table")).toMatch(/min-width:\s*0/);
    expect(rule(".rg-scroll")).toMatch(/overflow-x:\s*auto/);
  });

  it.each(["fr", "en"] as const)("%s: the scrolling table is a named region the keyboard can reach", (lang) => {
    const t = lang === "fr" ? fr : en;
    expect(home[lang]).toContain(`<div class="rg-scroll" role="region" tabindex="0" aria-label="${t.field.table.replace(/'/g, "&#x27;")}"><table>`);
  });
});

describe("indexing", () => {
  it.each(["fr", "en"] as const)("%s: the home page says index, follow, with its canonical address", async (lang) => {
    const meta = await generateMetadata({ params: Promise.resolve({ lang }) });
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe(`/${lang}`);
  });
});
