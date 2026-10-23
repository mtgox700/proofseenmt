import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FactLines } from "../src/components/market/FactLines";
import { ReferenceCard } from "../src/components/search/ReferenceCard";
import { marketDictionary } from "../src/i18n/market";
import { candidateFactLines } from "../src/lib/candidate-facts";

/*
 * Lot 5 of the connected space (CONNECTED_PLAN section 3): to choose and to find. One freelancer card in the whole
 * application, the facts of a candidate or a company as lines of the register (green square only on a fact a third
 * party verified), filter targets of 44 px, and no new order of people (AI Act).
 */

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(web, "src");
const read = (...parts: string[]): string => readFileSync(join(web, ...parts), "utf8");
const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
const html = (element: React.ReactElement): string => renderToStaticMarkup(element);
const board = marketDictionary("fr").missionsSpace.board;

describe("lines of the register", () => {
  it("draws the green square only before a verified fact, the ruled one before the rest", () => {
    const out = html(
      createElement(FactLines, {
        lines: [
          { text: "SIRET actif (vérifié le 12 octobre 2026)", verified: true },
          { text: "Sur Proofseen depuis le 2 mai 2026", verified: false },
        ],
        label: "Faits de l'entreprise",
      }),
    );
    expect(out).toBe(
      '<ul class="fact-lines" aria-label="Faits de l&#x27;entreprise"><li class="fact-line"><span class="sq" aria-hidden="true"></span><span>SIRET actif (vérifié le 12 octobre 2026)</span></li>' +
        '<li class="fact-line open"><span class="sq open" aria-hidden="true"></span><span>Sur Proofseen depuis le 2 mai 2026</span></li></ul>',
    );
    expect(html(createElement(FactLines, { lines: [] }))).toBe("");
  });

  it("writes a candidate's verified facts one by one, never added up, and says when there is none", () => {
    expect(candidateFactLines({ verifiedMissions: 2, verifiedUrls: 1 }, board)).toEqual([
      { text: "2 missions vérifiées", verified: true },
      { text: "1 adresse web dont la possession est prouvée", verified: true },
    ]);
    expect(candidateFactLines({ verifiedMissions: 0, verifiedUrls: 3 }, board)).toEqual([{ text: "3 adresses web dont la possession est prouvée", verified: true }]);
    expect(candidateFactLines({ verifiedMissions: 0, verifiedUrls: 0 }, board)).toEqual([{ text: "Pas encore de fait vérifié.", verified: false }]);
  });

  it("is used only where a fact read from the database earns it: the files are listed here", () => {
    const users = filesUnder(src)
      // Components that draw the lines; a module that only borrows the type draws nothing.
      .filter((f) => /\.tsx?$/.test(f) && /import \{ FactLines\b[^}]*\} from "@\/components\/market\/FactLines"/.test(readFileSync(f, "utf8")))
      .map((f) => relative(src, f).replace(/\\/g, "/"))
      .sort();
    expect(users).toEqual([
      // The company's SIRET, checked in the official register and dated; its measured facts stay ruled.
      "app/[lang]/app/entreprises/page.tsx",
      // A candidate whose profile left the public pages: the counts the application carries.
      "app/[lang]/app/missions/[id]/candidatures/[applicationId]/page.tsx",
      // Each applicant of a mission.
      "components/market/ApplicantsBoard.tsx",
    ]);
    // `verified: true` is written in two places only, each on a fact the database holds.
    const writers = filesUnder(src)
      .filter((f) => /\.tsx?$/.test(f) && /verified: true\b/.test(readFileSync(f, "utf8")))
      .map((f) => relative(src, f).replace(/\\/g, "/"))
      .sort();
    expect(writers).toEqual(["app/[lang]/app/entreprises/page.tsx", "lib/candidate-facts.ts"]);
    expect(read("src", "app", "[lang]", "app", "entreprises", "page.tsx")).toContain("company.registryActiveCheckedAt === null ? { text: c.registryUnknown, verified: false }");
  });
});

describe("a profile no longer published", () => {
  it("keeps the card's frame and its reference only: no fact, no link, no green", () => {
    const out = html(createElement(ReferenceCard, { reference: "FR-ZYXWV", title: "Profil FR-ZYXWV", headingId: "h", note: "Ce freelance a retiré son profil." }, createElement("p", null, "Note")));
    expect(out).toBe(
      '<article class="fiche-card ref-card" aria-labelledby="h"><p class="fc-trace">FR-ZYXWV</p><h3 class="fc-name" id="h">Profil FR-ZYXWV</h3><p class="ref-note">Ce freelance a retiré son profil.</p><div class="fc-actions"><p>Note</p></div></article>',
    );
    expect(out).not.toMatch(/<a |class="sq|fc-proof/);
  });
});

describe("the companies directory", () => {
  it("marks facts with squares, not ticks, and keeps the avatar off the poinçon's class", () => {
    const css = read("src", "styles", "discovery.css");
    expect(css).not.toContain("✓");
    expect(css).not.toMatch(/\.pc-badges|\.avatar\.sq\b|border-radius:\s*50%;\s*background:\s*currentColor/);
    expect(read("src", "components", "search", "Avatar.tsx")).not.toContain('" sq"');
    expect(read("src", "app", "[lang]", "app", "entreprises", "page.tsx")).not.toMatch(/pc-badges|✓/);
  });
});

describe("targets of the search and the directories (44 px)", () => {
  const MIN_REM = 2.75;
  const css = read("src", "styles", "discovery.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const minHeight = (selector: string): number => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css);
    const value = rule?.[1] === undefined ? null : /min-height:\s*([\d.]+)rem/.exec(rule[1]);
    if (value?.[1] === undefined) throw new Error(`no min-height in rem for ${selector}`);
    return Number(value[1]);
  };

  it.each([".check", ".side-links a", ".saved-actions .btn", ".sort-bar select", ".chip", ".pc-actions .btn", ".pc-list select", ".brief-box > summary", ".drawer > summary", ".save-search > summary"])(
    "%s is at least 44 px high",
    (selector) => {
      expect(minHeight(selector)).toBeGreaterThanOrEqual(MIN_REM);
    },
  );

  it("lets the whole row of a filter tick its box", () => {
    expect(css).toMatch(/\.check label \{[^}]*display: flex;[^}]*align-items: center;/);
    expect(css).toMatch(/\.check \{[^}]*align-items: stretch;/);
  });
});

describe("AI Act: no new order of people", () => {
  it("keeps the close profiles in the order the database gives and the screen writes", () => {
    const component = read("src", "components", "market", "ProfilesForMission.tsx");
    expect(component).not.toMatch(/\.sort\(|\.reverse\(|toSorted|%|<meter|<progress|score|rank/i);
    expect(component).toContain("{f.rule}");
    expect(read("src", "i18n", "market", "matching-fr.ts")).toContain(
      'rule: "Ordre\\u202f: nombre de critères remplis, puis nombre de compétences en commun, puis le profil mis à jour le plus récemment.",',
    );
  });

  it("keeps a list in its order of addition", () => {
    const page = read("src", "app", "[lang]", "app", "listes", "[id]", "page.tsx");
    expect(page).not.toMatch(/\.sort\(|\.reverse\(|toSorted|score|rank/i);
    expect(page).toContain("list.items.map((item) =>");
  });
});

describe("the sheet of the lot", () => {
  const sheet = read("src", "styles", "app-choisir.css").replace(/\/\*[\s\S]*?\*\//g, "");

  it("hides nothing, moves nothing and writes no colour of its own", () => {
    expect(sheet).not.toMatch(/opacity:\s*0(?![.\d])|scale[XY]?\(0\)|stroke-dashoffset|animation|transition/);
    expect(sheet).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|--ps-proof/i);
  });

  it("is loaded by the lot's screens only", () => {
    const importers = filesUnder(src)
      .filter((f) => /\.tsx?$/.test(f) && readFileSync(f, "utf8").includes('import "@/styles/app-choisir.css";'))
      .map((f) => relative(src, f).replace(/\\/g, "/"))
      .sort();
    expect(importers).toEqual([
      "app/[lang]/app/entreprises/page.tsx",
      "app/[lang]/app/listes/[id]/page.tsx",
      "app/[lang]/app/missions/[id]/candidatures/[applicationId]/page.tsx",
      "components/market/ApplicantsBoard.tsx",
      "components/market/ProfilesForMission.tsx",
    ]);
  });
});
