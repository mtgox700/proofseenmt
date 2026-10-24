import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import LandingPage, { generateMetadata } from "../src/app/[lang]/page";
import { homeCopy } from "../src/content/home";
import { homeEn } from "../src/content/home/en";
import { homeFr } from "../src/content/home/fr";
import { HomeCopySchema } from "../src/content/home/schema";
import { J0_CITATIONS } from "../src/data/j0-citations";
import { AnswersSnapshotSchema } from "../src/data/schema";
import { en } from "../src/i18n/en";
import { fr } from "../src/i18n/fr";
import { CONTACT_HREF, postMissionHref } from "../src/components/landing/routes";
import { buildRegistre } from "../src/lib/registre";

/*
 * The home page v2 (STORYBOARD_V2.md) as the server sends it. The page is rendered to static HTML (what a robot, a
 * reader without JavaScript or a full-page capture receives) and checked for what it must and must never carry; its
 * five sheets are read together for the rules of the brand's motion.
 */

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const stylesDir = join(web, "src", "styles");
const HOME_SHEETS = readdirSync(stylesDir).filter((f) => /^home(?:-[a-z]+)?\.css$/.test(f)).sort();
const styles = HOME_SHEETS.map((f) => readFileSync(join(stylesDir, f), "utf8"))
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const snapshot = AnswersSnapshotSchema.parse(JSON.parse(readFileSync(join(web, "data", "j0-answers.json"), "utf8")));

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
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

/** The same text, keeping the no-break spaces: `\s` would fold them, and they are the typography under test. */
const typedText = (html: string): string =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t\r\n\f]+/g, " ");

/** Walks the blocks of a sheet and returns, for each rule whose selector matches, the chain of its enclosing preludes. */
const contexts = (css: string, selector: RegExp): string[] => {
  const stack: string[] = [];
  const found: string[] = [];
  let prelude = "";
  for (const char of css) {
    if (char === "{") {
      const head = prelude.trim();
      if (selector.test(head)) found.push(stack.join(" | "));
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
  return found;
};

describe("the home page carries no price (decision of 2026-10-07)", () => {
  it.each(["fr", "en"] as const)("%s: no euro amount, no offer, no order page", (lang) => {
    const html = home[lang];
    expect(html).not.toMatch(/€|EUR\b/);
    expect(visibleText(html)).not.toMatch(/\b(?:prix|tarifs?|price|pricing|paiement unique|one-off payment)\b/i);
    expect(html).not.toContain(`/${lang}/commande`);
    expect(html).not.toMatch(/class="offers?\b/);
  });

  it("keeps no offer copy in the dictionaries", () => {
    expect("offers" in fr).toBe(false);
    expect("offers" in en).toBe(false);
  });
});

describe("the copy of the home page is typed, checked and the same in both languages", () => {
  it("parses both languages with the schema", () => {
    expect(() => HomeCopySchema.parse(homeFr)).not.toThrow();
    expect(() => HomeCopySchema.parse(homeEn)).not.toThrow();
  });

  it("writes only the five real figures of the storyboard, and the labelled example data", () => {
    // STORYBOARD_V2 §7: 780 answers, 0 citations, the wave of 23 and 24 September 2026, 30 days for an availability,
    // two levels of approval (in words). Every other number is example data under « Exemple illustratif » (12 days,
    // 21 October 2026, the week of 14 to 20 October, an address of the API, the CII norm), or the count of the
    // nine steps. A new number on this page has to be added here, with its source.
    const numbers = (copy: unknown): string[] => [...new Set(JSON.stringify(copy).match(/\d+/g) ?? [])].sort();
    expect(numbers(homeFr)).toEqual(["0", "1", "12", "16931", "18", "2026", "21", "23", "24", "30", "780", "9"]);
    expect(numbers(homeEn)).toEqual(["0", "1", "12", "16931", "18", "2026", "21", "23", "24", "30", "780", "9"]);
  });
});

describe("no scene waits for a script to be shown (Kensa B1)", () => {
  it("sets no Suspense boundary on the page: a boundary streams its scene out of order, hidden until a script runs", () => {
    const page = readFileSync(join(web, "src", "app", "[lang]", "page.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(page).not.toMatch(/<Suspense|from "react"/);
  });

  it.each(["fr", "en"] as const)("%s: the streamed HTML carries the journey and the company bento in place, never in a hidden block", async (lang) => {
    const { renderToReadableStream } = await import("react-dom/server");
    const stream = await renderToReadableStream(await LandingPage({ params: Promise.resolve({ lang }) }));
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).not.toContain('<div hidden id="S:');
    expect(html.indexOf('id="parcours"')).toBeGreaterThan(html.indexOf('id="verifie"'));
    expect(html.indexOf('id="outils-entreprise"')).toBeGreaterThan(html.indexOf('id="entreprises"'));
  });
});

describe("every scene is in the server HTML, in its final state", () => {
  it("renders the twelve scenes of the storyboard, in order", () => {
    const ids = [...home.fr.matchAll(/<section[^>]*?\b(?:id|aria-labelledby)="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["hero-title", "cap-title", "freelances", "verifie", "parcours", "entreprises", "outils-entreprise", "position", "mesure", "ressources", "faq", "exit-title"]);
  });

  it.each(["fr", "en"] as const)("%s: the nine steps of the journey are written in full", (lang) => {
    const text = visibleText(home[lang]);
    for (const step of homeCopy(lang).journey.steps) {
      expect(text).toContain(visibleText(step.title).trim());
      expect(text).toContain(visibleText(step.text).trim());
    }
    expect(text).toContain(visibleText(homeCopy(lang).journey.other.text).trim());
  });

  it.each(["fr", "en"] as const)("%s: the scene of the journey is sent at its last step, the mission verified", (lang) => {
    const html = home[lang];
    expect(html).toMatch(/<section class="mp" id="parcours"[^>]*data-step="9"/);
    expect(html).toMatch(/<div class="mp-scene" data-verified=""/);
    expect(visibleText(html.match(/<div class="mp-scene"[\s\S]*?<\/svg>[\s\S]*?<nav/)?.[0] ?? "")).toContain(visibleText(homeCopy(lang).journey.stage.states[8] ?? "").trim());
  });

  it.each([
    ["fr", "Exemple illustratif, données fictives."],
    ["en", "Illustrative example, fictitious data."],
  ] as const)("%s: labels every example as fictitious", (lang, label) => {
    // The hero's card, the bento of the freelancer, the bento of the company, the scene of the journey.
    expect(visibleText(home[lang]).split(label).length - 1).toBeGreaterThanOrEqual(4);
  });

  it.each(["fr", "en"] as const)("%s: shows a possible state on the opening's card: verified by the payment, funds paid out (Kensa M5)", (lang) => {
    const card = visibleText(home[lang].match(/<article class="hx-card"[\s\S]*?<\/article>/)?.[0] ?? "");
    expect(card).toContain(visibleText(homeCopy(lang).hero.card.facts[1]).trim());
    expect(card).not.toMatch(/séquestre|escrow/i);
    expect(styles).toMatch(/\.hx-fact-2 \{ color: var\(--ps-text\); \}/);
  });

  it.each(["fr", "en"] as const)("%s: keeps the example label beside the step counter, where a phone has no room for the card's (Kensa M4)", (lang) => {
    expect(visibleText(home[lang].match(/<p class="mp-counter">[\s\S]*?<\/p>/)?.[0] ?? "")).toContain(homeCopy(lang).journey.stage.sampleShort);
  });

  it.each(["fr", "en"] as const)("%s: reserves the place of the other way's button in every step, shown only by the script (Kensa M2)", (lang) => {
    const button = home[lang].match(/<button[^>]*class="btn mp-other"[^>]*>/)?.[0] ?? "";
    expect(button).not.toBe("");
    expect(button).not.toContain("data-shown");
    expect(button).toContain('aria-hidden="true"');
    expect(styles).toMatch(/\.mp-other:not\(\[data-shown\]\) \{ visibility: hidden; \}/);
  });

  it.each(["fr", "en"] as const)("%s: says that payments run in test mode until the founder opens them", (lang) => {
    expect(visibleText(home[lang])).toContain(visibleText(homeCopy(lang).journey.testMode));
  });

  it("hides no text behind a reveal: no armed state, no content-visibility, zero opacity only on decorative layers", () => {
    expect(home.fr).not.toMatch(/data-armed|data-in\b/);
    expect(styles).not.toMatch(/content-visibility/);
    expect(styles).not.toMatch(/data-armed/);
    // Keyframes aside (held below): the rules whose resting state is invisible.
    const zero = [...styles.matchAll(/([^{}]+)\{[^}]*opacity:\s*0(?![.\d])/g)]
      .map((m) => (m[1] ?? "").trim().replace(/\s+/g, " "))
      .filter((selector) => !/^(?:@keyframes .+|from|to|[\d.]+%(?:,\s*[\d.]+%)*)$/.test(selector));
    // Each of these is a layer of light or a pulse, aria-hidden, with no text: the halo of the strike, the dash of
    // a beam, the dots lit under the pointer, the edge light of a card or a door, the two halos of the journey's card.
    expect(zero.sort()).toEqual(
      [
        ".beam-glow",
        ".beam-pulse",
        ".dr-door::after",
        ".hx-card-ring",
        ".hx-dots-lit",
        ".mp-card::before, .mp-card::after",
        ".tile::after, .rs-card::after",
        ".tile::before, .rs-card::before",
      ].sort(),
    );
    expect(home.fr).toContain('<div class="hx-bg" aria-hidden="true">');
    expect(home.fr).toContain('<span class="hx-card-ring" aria-hidden="true">');
    // A keyframe starts below half-opacity only for those same layers of light: never a text.
    const faint = [...styles.matchAll(/@keyframes ([\w-]+) \{\s*(?:from|0%)[^{]*\{([^}]*)\}/g)]
      .filter((m) => Number(/opacity:\s*([\d.]+)/.exec(m[2] ?? "")?.[1] ?? "1") < 0.5)
      .map((m) => m[1]);
    expect(faint.sort()).toEqual(["hx-glow", "hx-ring", "hx-spotlight"]);
  });

  it("waits for a gesture only where a script will start it, and never under reduced motion", () => {
    const found = contexts(styles, /data-play\]/);
    // The register's reading rule (2 rules) and the gestures of the bento tiles (16 rules).
    expect(found.length).toBe(18);
    for (const context of found) expect(context).toBe("@media (scripting: enabled) and (prefers-reduced-motion: no-preference)");
  });

  it("runs every animation under prefers-reduced-motion: no-preference", () => {
    const stack: string[] = [];
    let prelude = "";
    const bare: string[] = [];
    for (const char of styles) {
      if (char === "{") {
        stack.push(prelude.trim());
        prelude = "";
      } else if (char === "}") {
        stack.pop();
        prelude = "";
      } else if (char === ";") {
        if (/^animation(?:-name)?\s*:/.test(prelude.trim()) && !stack.some((s) => /prefers-reduced-motion:\s*no-preference/.test(s))) bare.push(`${stack.join(" > ")} { ${prelude.trim()} }`);
        prelude = "";
      } else {
        prelude += char;
      }
    }
    expect(bare).toEqual([]);
  });

  it("loops only light that moves in transform, and pauses it off screen", () => {
    const loops = [...styles.matchAll(/([^{};]+)\{[^{}]*\binfinite\b/g)].map((m) => (m[1] ?? "").trim());
    expect(loops.sort()).toEqual([".hx-aurora", ".mq-track", ".shimmer::before", ".shimmer-btn .shimmer::before"].sort());
    for (const name of ["hx-drift", "mq-slide", "shimmer-spin", "shimmer-sweep"]) expect(styles).toMatch(new RegExp(`@keyframes ${name} \\{[^@]*?(?:transform|rotate):`));
    expect(styles).toMatch(/\.hx\[data-off\] \.hx-aurora \{ animation-play-state: paused; \}/);
    expect(styles).toMatch(/\[data-off\] \.mq-track \{ animation-play-state: paused; \}/);
    expect(styles).toMatch(/\[data-off\] \.shimmer::before \{ animation-play-state: paused; \}/);
    expect(styles).toMatch(/\[data-off\] \.shimmer-btn \.shimmer::before \{ animation-play-state: paused; \}/);
  });
});

describe("photos: real dimensions, two at once, the rest when near", () => {
  it.each(["fr", "en"] as const)("%s: every image has its size and its text, and only the opening loads at once", (lang) => {
    const images = [...home[lang].matchAll(/<img [^>]*>/g)].map((m) => m[0]);
    expect(images.length).toBeGreaterThanOrEqual(10);
    for (const img of images) {
      expect(img, img).toMatch(/\bwidth="\d+"/);
      expect(img, img).toMatch(/\bheight="\d+"/);
      expect(img, img).toMatch(/\balt="/);
    }
    const eager = images.filter((img) => img.includes('loading="eager"'));
    expect(eager.map((img) => /src="([^"]+)"/.exec(img)?.[1])).toEqual(["/images/v2/freelance-code-night-768.webp", "/images/v2/client-freelance-brief-768.webp"]);
    for (const img of eager) expect(img).not.toContain('fetchPriority="high"');
    // Every photo of the brand book comes with its AVIF first.
    expect((home[lang].match(/<source type="image\/avif"/g) ?? []).length).toBe((home[lang].match(/<source type="image\/webp"/g) ?? []).length);
  });
});

describe("every link leads to a page that exists", () => {
  const app = join(web, "src", "app", "[lang]");
  const exists = (href: string): boolean => {
    if (href.startsWith("#")) return true;
    const legacy = join(web, "public", "legacy", ...href.split("/").filter(Boolean), "index.html");
    if (existsSync(legacy)) return true;
    if (/^\/(?:images|brand)\//.test(href)) return existsSync(join(web, "public", ...href.split("/").filter(Boolean)));
    const [, , ...segments] = href.split("?")[0]?.split("/") ?? [];
    const dir = join(app, ...segments);
    if (segments.length === 0) return true;
    if (existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "route.ts"))) return true;
    // An optional catch-all (the sign-up of Clerk) answers its own address.
    return existsSync(join(dir, "[[...rest]]", "page.tsx"));
  };

  it.each(["fr", "en"] as const)("%s: internal links and anchors", (lang) => {
    const main = home[lang].match(/<main[\s\S]*<\/main>/)?.[0] ?? "";
    const hrefs = [...new Set([...main.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1] ?? ""))];
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs.filter((h) => h !== CONTACT_HREF)) {
      expect(href.startsWith("/") || href.startsWith("#"), href).toBe(true);
      expect(exists(href), href).toBe(true);
      if (href.startsWith("#")) expect(home[lang], href).toContain(`id="${href.slice(1)}"`);
    }
    for (const expected of [`/${lang}/creer-un-compte`, postMissionHref(lang), `/${lang}/freelances`, `/${lang}/barometre/tjm`, `/${lang}/simulateur`, `/${lang}/blog`, `/${lang}/inscription`, "#parcours", CONTACT_HREF]) expect(hrefs).toContain(expected);
    // Posting a mission never lands on a bare redirect: account creation, then back to the form (Kensa M6).
    expect(hrefs).not.toContain(`/${lang}/app/missions/nouvelle`);
    expect(postMissionHref(lang)).toBe(`/${lang}/creer-un-compte?redirect_url=%2F${lang}%2Fapp%2Fmissions%2Fnouvelle`);
  });

  it("keeps motion out of the first load: only the animated scene, fetched near the journey, imports it", () => {
    const dir = join(web, "src", "components", "landing");
    const users = readdirSync(dir).filter((f) => /from "motion\//.test(readFileSync(join(dir, f), "utf8")));
    expect(users.sort()).toEqual(["MissionScene.tsx", "motion-features.ts"]);
    const stage = readFileSync(join(dir, "MissionStage.tsx"), "utf8");
    expect(stage).not.toMatch(/^import[^;]*["']\.\/MissionScene["']/m);
    expect(stage).toContain('import("./MissionScene")');
  });

  it("never prefetches a page from the home page: plain links, no next/link", () => {
    const sources = readdirSync(join(web, "src", "components", "landing")).map((f) => readFileSync(join(web, "src", "components", "landing", f), "utf8"));
    expect(sources.filter((code) => code.includes('from "next/link"'))).toEqual([]);
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

  it.each(["fr", "en"] as const)("%s: shows five figures at most in the measure, each with its source; the counts stay in the folded table (Kensa M11)", (lang) => {
    const section = home[lang].match(/<section class="section ai"[\s\S]*?<\/section>/)?.[0] ?? "";
    const shown = visibleText(section.replace(/<details[\s\S]*?<\/details>/g, ""));
    expect([...new Set(shown.match(/\d+(?:[,.]\d+)?/g) ?? [])].sort()).toEqual(["0", "2026", "23", "24", "780"]);
    expect(shown).toContain(lang === "fr" ? "23 et 24 septembre 2026" : "23 and 24 September 2026");
  });

  it("states the measure with its wave, beside the figure", () => {
    expect(visibleText(home.fr)).toContain("0 citation sur 780 réponses");
    expect(visibleText(home.fr)).toContain("Vague J0, 23 et 24 septembre 2026, protocole figé avant la mesure.");
    expect(visibleText(home.en)).toContain("0 citations out of 780 answers");
  });

  it("offers the same tally as a table, and a filter that works without script", () => {
    expect(home.fr).toMatch(/<details class="rg-table"><summary>Lire le relevé en tableau<\/summary>/);
    expect((home.fr.match(/<input[^>]*type="radio"[^>]*name="rg-source"/g) ?? []).length).toBe(7);
  });

  it("holds the fixed citation counts against the answers snapshot of the same wave", () => {
    expect(snapshot.waveId).toBe("J0");
    expect(J0_CITATIONS.answers).toBe(snapshot.answers.length);
    expect(snapshot.answers.reduce((sum, a) => sum + a.other, 0)).toBe(J0_CITATIONS.other);
    const platforms = Object.values(J0_CITATIONS.platforms).reduce((a, b) => a + b, 0);
    expect(platforms + J0_CITATIONS.other).toBe(J0_CITATIONS.total);
  });
});

describe("nothing widens the page on a phone (Kensa B1)", () => {
  // The first top-level rule of a selector (a rule inside a media query follows a "{", not a "}").
  const rule = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(styles)?.[1] ?? "";
  };

  it("gives every grid of the page tracks that may shrink below their content", () => {
    for (const grid of [".hx-grid", ".registre", ".ai-grid", ".bento", ".mp-grid", ".vf-grid", ".fq-grid", ".rs-grid", ".dr-doors"]) {
      expect(rule(grid), grid).toMatch(/display:\s*grid/);
      expect(rule(grid), grid).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    }
    expect(rule(".rg-table")).toMatch(/min-width:\s*0/);
    expect(rule(".rg-scroll")).toMatch(/overflow-x:\s*auto/);
    expect(rule(".rg-scroll")).toMatch(/container-type:\s*inline-size/);
    expect(rule(".rg-table caption")).toMatch(/max-width:\s*100cqi/);
    expect(rule(".code")).toMatch(/overflow-x:\s*auto/);
    expect(rule(".home")).toMatch(/overflow-x:\s*clip/);
  });

  it.each(["fr", "en"] as const)("%s: the scrolling table and the code are named regions the keyboard can reach", (lang) => {
    const t = lang === "fr" ? fr : en;
    expect(home[lang]).toContain(`<div class="rg-scroll" role="region" tabindex="0" aria-label="${t.field.table.replace(/'/g, "&#x27;")}"><table>`);
    expect(home[lang]).toMatch(/<div class="code" role="region" tabindex="0" aria-label="GET \/api\/v1\/contracts">/);
  });
});

describe("indexing", () => {
  it.each(["fr", "en"] as const)("%s: the home page says index, follow, with its canonical address", async (lang) => {
    const meta = await generateMetadata({ params: Promise.resolve({ lang }) });
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe(`/${lang}`);
  });
});

describe("French typography of the home page as served (Kensa N6)", () => {
  it("fr: no plain or no-break space before « : ; ? ! », none inside guillemets, in the text or the labels", () => {
    // Text between tags and the attributes a reader hears or sees (aria-label, alt, title, placeholder).
    const html = home.fr.replace(/<(script|style)[\s\S]*?<\/\1>/g, "");
    const labels = [...html.matchAll(/\b(?:aria-label|alt|title|placeholder|content)="([^"]*)"/g)].map((m) => m[1] ?? "");
    const loose = new RegExp(`[ ${String.fromCharCode(0xa0)}][:;?!»]|«[ ${String.fromCharCode(0xa0)}]`, "g");
    const found = [typedText(html), ...labels].flatMap((text) => [...text.matchAll(loose)].map((m) => text.slice(Math.max(0, m.index - 30), m.index + 2)));
    expect(found).toEqual([]);
  });

  it("en: keeps the English colon, with no space before it", () => {
    expect(visibleText(home.en)).not.toContain(String.fromCharCode(0x202f) + ":");
  });
});
