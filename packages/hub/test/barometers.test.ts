import { describe, expect, it } from "vitest";
import { rateCsv, rateJson, skillCsv, skillJson, type RateBarometerView, type SkillBarometerView } from "../src/barometer-data";
import { renderRateBarometer } from "../src/barometer-rates";
import { renderSkillBarometer } from "../src/barometer-skills";

const BASE = "https://proofseen.com";
const NOW = new Date("2026-10-15T12:00:00Z");

const EMPTY: RateBarometerView = {
  computedAt: NOW,
  currency: "EUR",
  minSample: 10,
  missionsSince: new Date("2026-07-17T12:00:00Z"),
  profiles: { total: 3, overall: null, bySkill: [], byCity: [] },
  missions: { total: 0, overall: null, bySkill: [], byCity: [] },
};

const stat = (key: string, label: string, n = 12) => ({ key, label, n, p25Cents: 50_000, medianCents: 60_000, p75Cents: 70_000 });

const FILLED: RateBarometerView = {
  ...EMPTY,
  profiles: { total: 14, overall: stat("all", "all", 14), bySkill: [stat("rust", "Rust")], byCity: [stat("lyon", "=HYPERLINK(\"x\")")] },
};

const scripts = (html: string): string[] => [...html.matchAll(/<script\b([^>]*)>/gi)].map(([, attrs]) => attrs ?? "");
const jsonLdOf = (html: string): Record<string, unknown> => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "{}") as Record<string, unknown>;

describe("baromètre des TJM", () => {
  it("sous le seuil, dit qu'il manque des données et n'affiche aucune statistique", () => {
    const html = renderRateBarometer(EMPTY, { baseUrl: BASE, lang: "fr" });
    expect(html).toContain("Pas encore assez de données : il faut au moins 10 profils ou missions par groupe.");
    expect(html).not.toContain("<table");
    expect(html).not.toMatch(/médiane \d/i);
    expect(html).toContain("aucun groupe de moins de 10 valeurs n'est publié");
    expect(scripts(html).every((attrs) => /application\/ld\+json/.test(attrs))).toBe(true);
    expect(html).toContain('<link rel="canonical" href="https://proofseen.com/fr/barometre/tjm">');
  });

  it("publie chaque groupe avec n, médiane et quartiles, la méthode et la date", () => {
    const html = renderRateBarometer(FILLED, { baseUrl: BASE, lang: "fr" });
    expect(html).not.toContain("Pas encore assez de données");
    expect(html).toMatch(/<th scope="row">Rust<\/th><td class="num">12<\/td><td class="num">500\s€<\/td><td class="num">600\s€<\/td><td class="num">700\s€<\/td>/);
    expect(html).toContain("(n = 14)");
    expect(html).toContain("&quot;x&quot;");
    expect(html).toContain("Méthode");
    expect(html).toContain("PERCENTILE.INC");
    expect(html).toContain('datetime="2026-10-15T12:00:00.000Z"');
    expect(html).toContain('href="/barometre/tjm.csv"');
  });

  it("se décrit comme un jeu de données : distribution, période, variables, licence, créateur", () => {
    expect(jsonLdOf(renderRateBarometer(FILLED, { baseUrl: BASE, lang: "en" }))).toMatchObject({
      "@type": "Dataset",
      license: "https://creativecommons.org/licenses/by/4.0/",
      creator: { "@type": "Organization", name: "Proofseen" },
      temporalCoverage: "2026-07-17/2026-10-15",
      variableMeasured: [{ name: "n" }, { name: "p25" }, { name: "median" }, { name: "p75" }],
      distribution: [
        { encodingFormat: "text/csv", contentUrl: "https://proofseen.com/barometre/tjm.csv" },
        { encodingFormat: "application/json", contentUrl: "https://proofseen.com/barometre/tjm.json" },
      ],
    });
  });

  it("exporte les mêmes groupes en CSV (sans formule) et en JSON, rien sous le seuil", () => {
    expect(rateCsv(EMPTY)).toBe("source,dimension,key,label,n,p25_eur,median_eur,p75_eur,currency,computed_at\r\n");
    const csv = rateCsv(FILLED);
    expect(csv).toContain("profiles,all,all,all,14,500,600,700,EUR,2026-10-15T12:00:00.000Z");
    expect(csv).toContain("profiles,skill,rust,Rust,12,500,600,700,EUR,");
    expect(csv).toContain('profiles,city,lyon,"\'=HYPERLINK(""x"")",12,');
    const json = JSON.parse(rateJson(FILLED, BASE)) as { rows: unknown[]; minSample: number; license: string; totals: unknown };
    expect(json.rows).toHaveLength(3);
    expect(json).toMatchObject({ minSample: 10, license: "https://creativecommons.org/licenses/by/4.0/", totals: { profilesWithRate: 14, missionsWithRate: 0 } });
    expect((JSON.parse(rateJson(EMPTY, BASE)) as { rows: unknown[] }).rows).toEqual([]);
  });
});

describe("baromètre des compétences", () => {
  const view: SkillBarometerView = { computedAt: NOW, since: new Date("2026-07-17T12:00:00Z"), minCount: 5, totalMissions: 3, skills: [] };

  it("sous le seuil, ne publie rien et le dit", () => {
    const html = renderSkillBarometer(view, { baseUrl: BASE, lang: "fr" });
    expect(html).toContain("Pas encore assez de données : il faut au moins 5 missions pour qu'une compétence apparaisse.");
    expect(html).not.toContain("<table");
    expect(skillCsv(view)).toBe("key,label,missions,since,computed_at\r\n");
  });

  it("liste les compétences avec leur nombre de missions, en page et en données", () => {
    const filled = { ...view, totalMissions: 9, skills: [{ key: "go", label: "Go", missions: 7 }, { key: "c#", label: "C#", missions: 5 }] };
    const html = renderSkillBarometer(filled, { baseUrl: BASE, lang: "en" });
    expect(html).toContain('<tr><th scope="row">Go</th><td class="num">7</td></tr>');
    expect(html).toContain("9 missions published over the period.");
    expect(jsonLdOf(html)).toMatchObject({ "@type": "Dataset", distribution: [{ contentUrl: "https://proofseen.com/barometre/competences.csv" }, { contentUrl: "https://proofseen.com/barometre/competences.json" }] });
    expect(skillCsv(filled)).toContain("go,Go,7,2026-07-17,");
    expect((JSON.parse(skillJson(filled, BASE)) as { rows: unknown[] }).rows).toEqual([{ key: "go", label: "Go", missions: 7 }, { key: "c#", label: "C#", missions: 5 }]);
  });
});
