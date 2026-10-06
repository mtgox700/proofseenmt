import { describe, expect, it } from "vitest";
import { wilson, type Engine, type EngineFunnel } from "@proofseen/stats";
import { MAX_ACTIONS, MAX_PLATFORM_ACTIONS, REFUSAL_LIMIT, correctionPlan, type PlanInput, type Surface } from "../src/plan";

const stage = (successes: number, draws: number) => ({ successes, interval: wilson(successes, draws) });
/** Un moteur dont on fixe chaque étape : E2 ⊇ E3 ⊇ E4 ⊇ E5, comme dans une vraie vague. */
const engine = (engine: Engine, draws: number, [e2, e3, e4, e5]: readonly number[]): EngineFunnel => ({
  engine,
  draws,
  retrieved: stage(e2!, draws),
  named: stage(e3!, draws),
  top5: stage(e4!, draws),
  cited: stage(e5!, draws),
});

const READY: Surface = { readableWithoutJs: true, robotsTxt: true, sitemap: true, structuredData: true, verifiedPlatforms: ["github.com"] };
const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  funnel: [engine("openai", 200, [0, 0, 0, 0])],
  indexation: { pagesDeclared: 10, pagesIndexed: 10, checkedAt: "2026-10-24" },
  surface: READY,
  sourceShare: {},
  refusalRate: {},
  ...over,
});

describe("l'étape qui bloque", () => {
  it("désigne l'indexation quand aucune page n'est indexée, et ne propose rien sur les étapes suivantes", () => {
    const plan = correctionPlan(input({ indexation: { pagesDeclared: 10, pagesIndexed: 0, checkedAt: "2026-10-24" } }));
    expect(plan.blockingStage).toBe("E1");
    expect(new Set(plan.actions.map((a) => a.stage))).toEqual(new Set(["E1"]));
  });

  it("ne met pas l'indexation en cause quand elle n'a pas été mesurée, et le dit", () => {
    const plan = correctionPlan(input({ indexation: null }));
    expect(plan.blockingStage).toBe("E2");
    expect(plan.notActionable.join(" ")).toContain("n'a pas été mesurée");
  });

  it("désigne la récupération quand les pages sont indexées mais jamais retrouvées", () => {
    expect(correctionPlan(input()).blockingStage).toBe("E2");
  });

  it("désigne la nomination quand la page est retrouvée mais que personne n'est nommé", () => {
    const plan = correctionPlan(input({ funnel: [engine("openai", 200, [40, 0, 0, 0])] }));
    expect(plan.blockingStage).toBe("E3");
  });

  it("désigne le classement quand le profil est nommé mais jamais dans les cinq premiers", () => {
    const plan = correctionPlan(input({ funnel: [engine("openai", 200, [40, 30, 0, 0])] }));
    expect(plan.blockingStage).toBe("E4");
  });

  it("ne bloque nulle part quand toutes les étapes passent, et ne fabrique alors aucune action", () => {
    const plan = correctionPlan(input({ funnel: [engine("openai", 200, [120, 100, 90, 80])] }));
    expect(plan.blockingStage).toBeNull();
    expect(plan.actions).toEqual([]);
  });

  it("prend l'étape la plus précoce quand deux moteurs bloquent à des endroits différents", () => {
    const plan = correctionPlan(input({ funnel: [engine("openai", 200, [40, 30, 20, 0]), engine("perplexity", 200, [0, 0, 0, 0])] }));
    expect(plan.blockingStage).toBe("E2");
  });
});

describe("ce sur quoi le client ne peut rien", () => {
  it("énonce un moteur qui refuse de nommer, sans en faire une action", () => {
    const plan = correctionPlan(input({ refusalRate: { anthropic: REFUSAL_LIMIT + 0.01 } }));
    expect(plan.notActionable.join(" ")).toContain("anthropic");
    expect(plan.actions.some((a) => a.why.includes("anthropic") || a.where.includes("anthropic"))).toBe(false);
  });

  it("ne signale pas un moteur qui refuse rarement", () => {
    const plan = correctionPlan(input({ refusalRate: { anthropic: REFUSAL_LIMIT - 0.01 } }));
    expect(plan.notActionable.join(" ")).not.toContain("anthropic");
  });
});

describe("les plateformes que les moteurs citent", () => {
  it("propose d'être présent sur une plateforme dominante où la présence n'est pas vérifiée", () => {
    const plan = correctionPlan(input({ sourceShare: { "malt.fr": 0.39 } }));
    const action = plan.actions.find((a) => a.where.includes("malt.fr"));
    expect(action).toBeDefined();
    expect(action!.evidence).toContain("39,0\u00a0%");
  });

  it("ne propose rien pour une plateforme où la présence est déjà vérifiée", () => {
    const plan = correctionPlan(input({ sourceShare: { "github.com": 0.39 } }));
    expect(plan.actions.some((a) => a.where.includes("github.com"))).toBe(false);
  });

  it("ignore une plateforme marginale", () => {
    const plan = correctionPlan(input({ sourceShare: { "codeur.com": 0.005 } }));
    expect(plan.actions.some((a) => a.where.includes("codeur.com"))).toBe(false);
  });
});

describe("forme du plan", () => {
  it("tient le plafond contractuel dans le pire cas, sans rien écarter, et numérote sans trou", () => {
    // Pire cas atteignable : E1 bloque et rien n'est en place (3 actions), plus 20 plateformes dominantes absentes.
    const many = Object.fromEntries([...Array(20)].map((_, i) => [`p${i}.example`, 0.2]));
    const plan = correctionPlan(
      input({
        indexation: { pagesDeclared: 10, pagesIndexed: 0, checkedAt: "2026-10-24" },
        surface: { readableWithoutJs: false, robotsTxt: false, sitemap: false, structuredData: false, verifiedPlatforms: [] },
        sourceShare: many,
      }),
    );
    expect(plan.actions.length).toBeLessThanOrEqual(MAX_ACTIONS);
    // Les règles ne peuvent pas produire plus de 8 actions : le plafond est une garantie, pas un tri.
    expect(plan.dropped).toBe(0);
    expect(plan.actions.filter((a) => a.id.startsWith("source-"))).toHaveLength(MAX_PLATFORM_ACTIONS);
    expect(plan.actions.map((a) => a.rank)).toEqual([...Array(plan.actions.length)].map((_, i) => i + 1));
  });

  it("chaque action porte le chiffre mesuré qui la justifie", () => {
    const plan = correctionPlan(input({ indexation: { pagesDeclared: 10, pagesIndexed: 0, checkedAt: "2026-10-24" } }));
    for (const action of plan.actions) expect(action.evidence).toMatch(/\d/);
  });

  it("aucune action ne promet un résultat", () => {
    const plan = correctionPlan(input({ surface: { ...READY, readableWithoutJs: false }, sourceShare: { "malt.fr": 0.39 } }));
    const words = /garanti|garantit|assure|vous serez cité|100 %|promet/i;
    for (const action of plan.actions) expect(`${action.title} ${action.why} ${action.where}`).not.toMatch(words);
  });

  it("refuse une vague vide plutôt que de conclure sur rien", () => {
    expect(() => correctionPlan(input({ funnel: [] }))).toThrow(/aucun moteur/);
  });
});

/*
 * Constat du 02/10, première vague client réelle (`AUDIT-FR-ZK7M4`) : Anthropic retrouvait le sujet 5 fois sur 60,
 * OpenAI et Perplexity 0 fois chacun. Le plan lui conseillait « d'aligner son vocabulaire sur les offres » — alors
 * que les mêmes pages, sur les mêmes offres, le même jour, étaient retrouvées par un moteur et pas par les autres, et
 * qu'une vérification terme à terme montrait que chaque compétence pratiquée et employée par les offres figurait déjà
 * sur son site. Ces tests empêchent le plan de redonner un conseil qui désigne la mauvaise cause.
 */
describe("un écart de récupération entre moteurs désigne l'index, pas le vocabulaire", () => {
  // La forme exacte de la vague réelle : un moteur retrouve et nomme, les deux autres jamais.
  const split = [engine("anthropic", 60, [5, 5, 5, 5]), engine("openai", 60, [0, 0, 0, 0]), engine("perplexity", 60, [0, 0, 0, 0])];

  it("propose l'indexation par le moteur qui ne retrouve pas, et plus le vocabulaire", () => {
    const plan = correctionPlan(input({ funnel: split, indexation: null }));
    const ids = plan.actions.map((action) => action.id);
    expect(ids).toContain("E2-index-moteur");
    expect(ids).not.toContain("E2-vocabulaire");
  });

  it("nomme les moteurs des deux côtés et l'index que lisent ceux qui manquent", () => {
    const action = correctionPlan(input({ funnel: split, indexation: null })).actions.find((a) => a.id === "E2-index-moteur")!;
    expect(action.title).toBe("Faire indexer vos pages là où OpenAI et Perplexity cherchent");
    expect(action.why).toContain("retrouvées par Anthropic, jamais par OpenAI et Perplexity");
    expect(action.why).toContain("l'index que lisent ces moteurs");
    // OpenAI et Perplexity tirent leur web de Bing : c'est là que la consigne envoie.
    expect(action.where).toContain("Bing");
    // Leurs propres robots n'ont pas de formulaire : la seule consigne utile est de faire pointer des liens.
    expect(action.where).toContain("suivent les liens");
  });

  it("accorde au singulier quand un seul moteur manque", () => {
    const one = [engine("anthropic", 60, [5, 5, 5, 5]), engine("openai", 60, [0, 0, 0, 0])];
    const action = correctionPlan(input({ funnel: one, indexation: null })).actions.find((a) => a.id === "E2-index-moteur")!;
    expect(action.title).toBe("Faire indexer vos pages là où OpenAI cherche");
    expect(action.why).toContain("l'index que lit ce moteur");
  });

  it("appuie l'action sur les comptes mesurés, moteur par moteur", () => {
    const action = correctionPlan(input({ funnel: split, indexation: null })).actions.find((a) => a.id === "E2-index-moteur")!;
    expect(action.evidence).toBe("anthropic 5/60 · openai 0/60 · perplexity 0/60");
  });

  it("garde le vocabulaire quand aucun moteur ne retrouve le profil : rien ne permet alors d'écarter cette cause", () => {
    const none = [engine("anthropic", 60, [0, 0, 0, 0]), engine("openai", 60, [0, 0, 0, 0])];
    const ids = correctionPlan(input({ funnel: none })).actions.map((action) => action.id);
    expect(ids).toContain("E2-vocabulaire");
    expect(ids).not.toContain("E2-index-moteur");
  });

  it("ne propose aucune action de récupération quand tous les moteurs retrouvent le profil", () => {
    const all = [engine("anthropic", 60, [10, 10, 10, 10]), engine("openai", 60, [8, 8, 8, 8])];
    const ids = correctionPlan(input({ funnel: all })).actions.map((action) => action.id);
    expect(ids).not.toContain("E2-index-moteur");
    expect(ids).not.toContain("E2-vocabulaire");
  });
});
