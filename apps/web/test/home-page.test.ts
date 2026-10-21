import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import LandingPage, { generateMetadata } from "../src/app/[lang]/page";
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

describe("indexing", () => {
  it.each(["fr", "en"] as const)("%s: the home page says index, follow, with its canonical address", async (lang) => {
    const meta = await generateMetadata({ params: Promise.resolve({ lang }) });
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe(`/${lang}`);
  });
});
