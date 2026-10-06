import { describe, expect, it } from "vitest";
import { wilson, type Engine, type EngineFunnel } from "@proofseen/stats";
import { correctionPlan, type PlanInput, type Surface } from "../src/plan";

/*
 * Le plan de correction dit au client quoi faire sur ses propres surfaces, dont des plateformes tierces. Un conseil
 * qui viole leurs règles ne nous coûte rien : c'est **lui** qui se fait bannir.
 *
 * CONFORMITE §7 fixe ce qu'on recommande et ce qu'on interdit. Ce fichier vérifie que le plan produit reste du bon
 * côté, quelles que soient les données d'entrée — y compris celles qui déclenchent toutes les actions à la fois.
 */

const stage = (successes: number, draws: number) => ({ successes, interval: wilson(successes, draws) });
const engine = (name: Engine, draws: number, [e2, e3, e4, e5]: readonly number[]): EngineFunnel => ({
  engine: name,
  draws,
  retrieved: stage(e2!, draws),
  named: stage(e3!, draws),
  top5: stage(e4!, draws),
  cited: stage(e5!, draws),
});

const NOTHING: Surface = { readableWithoutJs: false, robotsTxt: false, sitemap: false, structuredData: false, verifiedPlatforms: [] };
const READY: Surface = { readableWithoutJs: true, robotsTxt: true, sitemap: true, structuredData: true, verifiedPlatforms: [] };

/** Tous les plans que les règles peuvent produire, pour qu'aucune action n'échappe au contrôle. */
const everyPlan = (): PlanInput[] => {
  const sources = { "malt.fr": 0.39, "linkedin.com": 0.265, "github.com": 0.03 };
  const funnels: readonly EngineFunnel[][] = [
    [engine("openai", 200, [0, 0, 0, 0])],
    [engine("openai", 200, [40, 0, 0, 0])],
    [engine("openai", 200, [40, 30, 0, 0])],
    [engine("openai", 200, [40, 30, 25, 0])],
  ];
  return [
    { funnel: funnels[0]!, indexation: { pagesDeclared: 4, pagesIndexed: 0, checkedAt: "2026-10-24" }, surface: NOTHING, sourceShare: sources, refusalRate: {} },
    { funnel: funnels[0]!, indexation: { pagesDeclared: 4, pagesIndexed: 4, checkedAt: "2026-10-24" }, surface: READY, sourceShare: sources, refusalRate: {} },
    ...funnels.map((funnel) => ({ funnel, indexation: null, surface: READY, sourceShare: sources, refusalRate: { anthropic: 0.3 } })),
  ];
};

const allText = () =>
  everyPlan()
    .flatMap((input) => correctionPlan(input).actions)
    .map((action) => `${action.title}\n${action.why}\n${action.where}`)
    .join("\n\n");

describe("le plan ne conseille jamais ce que les plateformes interdisent", () => {
  it("produit bien des actions dans tous les cas testés : le contrôle porte sur quelque chose", () => {
    expect(allText().length).toBeGreaterThan(500);
  });

  it("ne recommande aucune automatisation ni robot sur un compte", () => {
    // LinkedIn §8.2 : publication automatisée, bots, extensions qui agissent sur le compte.
    expect(allText()).not.toMatch(/automatis|bot\b|robot d'envoi|extension|script qui publie|publier automatiquement/i);
  });

  it("ne recommande jamais de collecter des données sur une plateforme", () => {
    // Malt §10.2, GitHub §4 et §7 : scraping, faux comptes, revente de données.
    expect(allText()).not.toMatch(/scraper|scraping|aspirer|collecter des profils|extraire des données|faux compte/i);
  });

  it("ne recommande aucune mention artificielle ni échange de complaisance", () => {
    expect(allText()).not.toMatch(/échange de mentions|faux témoignage|acheter des avis|réseau de sites|backlink/i);
  });

  it("ne recommande jamais de texte caché, d'instruction aux IA ou de cloaking", () => {
    expect(allText()).not.toMatch(/texte caché|display\s*:\s*none|instruction aux IA|adressée? aux IA|cloaking|contenu différent/i);
  });

  it("exige des faits vrais partout où il touche au contenu", () => {
    const plans = everyPlan().flatMap((input) => correctionPlan(input).actions);
    const vocabulaire = plans.find((action) => action.id === "E2-vocabulaire");
    const preuves = plans.find((action) => action.id === "E4-preuves");
    expect(vocabulaire?.where).toMatch(/uniquement ceux que vous pratiquez réellement/);
    expect(preuves?.where).toMatch(/Aucun fait que vous ne pouvez prouver/);
  });

  it("ne demande sur une plateforme que d'y être présent, avec les mêmes faits qu'ailleurs", () => {
    const platform = everyPlan()
      .flatMap((input) => correctionPlan(input).actions)
      .filter((action) => action.id.startsWith("source-"));
    expect(platform.length).toBeGreaterThan(0);
    for (const action of platform) expect(action.where).toMatch(/les mêmes faits que votre page de référence/);
  });

  it("ne promet jamais un résultat, quel que soit le plan produit", () => {
    expect(allText()).not.toMatch(/garanti|assurons|vous serez cité|première place|top 1\b/i);
  });
});
