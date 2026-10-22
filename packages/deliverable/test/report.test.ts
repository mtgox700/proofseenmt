import { describe, expect, it } from "vitest";
import { wilson, type Engine, type EngineFunnel } from "@proofseen/stats";
import { compareWaves } from "../src/comparison";
import { correctionPlan, type PlanInput, type Surface } from "../src/plan";
import { renderClientReport, renderClientReportHtml, type ClientReportInput } from "../src/report";

const stage = (successes: number, draws: number) => ({ successes, interval: wilson(successes, draws) });
const engineFunnel = (engine: Engine, draws: number, [e2, e3, e4, e5]: readonly number[]): EngineFunnel => ({
  engine,
  draws,
  retrieved: stage(e2!, draws),
  named: stage(e3!, draws),
  top5: stage(e4!, draws),
  cited: stage(e5!, draws),
});

const SURFACE: Surface = { readableWithoutJs: true, robotsTxt: true, sitemap: true, structuredData: true, verifiedPlatforms: [] };
const FUNNEL = [engineFunnel("openai", 200, [0, 0, 0, 0]), engineFunnel("perplexity", 200, [12, 4, 0, 0])];
const planInput: PlanInput = {
  funnel: FUNNEL,
  indexation: { pagesDeclared: 4, pagesIndexed: 4, checkedAt: "2026-10-24" },
  surface: SURFACE,
  sourceShare: { "malt.fr": 0.39, "linkedin.com": 0.265 },
  refusalRate: { anthropic: 0.288 },
};

const input = (over: Partial<ClientReportInput> = {}): ClientReportInput => ({
  client: { displayName: "Camille Dupont", reference: "FR-1AB2C" },
  wave: {
    id: "AUDIT-001",
    measuredAt: "2026-10-24",
    models: { openai: "gpt-5-mini", perplexity: "sonar", anthropic: "claude-haiku-4-5" },
    draws: 400,
    manifestDigest: "1bc9f85f62017577",
  },
  jobDescriptions: [
    { id: "T01", label: "Développeur full stack TypeScript, Paris", provenance: "client", role: "target" },
    { id: "T02", label: "Lead développeur Node.js", provenance: "client", role: "target" },
    { id: "C01", label: "Développeur SAP ABAP senior", provenance: "proofseen", role: "control" },
  ],
  funnel: FUNNEL,
  sourceShare: planInput.sourceShare,
  indexation: planInput.indexation,
  controlRetrieval: { p: 0, low: 0, high: 0.019 },
  plan: correctionPlan(planInput),
  caveats: ["Gemini et Copilot ne sont pas couverts par cette mesure."],
  simulated: false,
  ...over,
});

describe("en-tête du rapport", () => {
  it("date la mesure, nomme les modèles et compte les tirages", () => {
    const report = renderClientReport(input());
    expect(report).toContain("24 octobre 2026");
    expect(report).toContain("gpt-5-mini");
    expect(report).toContain("400");
    expect(report).toContain("1bc9f85f62017577");
  });

  it("étiquette les offres fournies par le client et l'offre témoin", () => {
    const report = renderClientReport(input());
    expect(report).toMatch(/Développeur full stack TypeScript, Paris.*fournie par vous/);
    expect(report).toMatch(/Développeur SAP ABAP senior.*témoin/);
  });
});

describe("les offres témoins", () => {
  // Dire « y apparaître serait un mauvais signe » sans donner le chiffre reviendrait à énoncer un critère sans
  // jamais l'appliquer devant le client.
  it("dit qu'il n'y est pas apparu, avec sa fourchette", () => {
    const report = renderClientReport(input());
    expect(report).toMatch(/vous n'avez été retrouvé \*\*aucune fois\*\*/);
    expect(report).toContain("C'est le résultat attendu");
  });

  it("l'avertit quand il y apparaît : ses taux se lisent alors autrement", () => {
    const report = renderClientReport(input({ controlRetrieval: { p: 0.12, low: 0.07, high: 0.2 } }));
    expect(report).toContain("⚠ Sur ces offres témoins, vous avez été retrouvé dans **12,0\u00a0%**");
    expect(report).toMatch(/missions qui ne vous correspondent pas/);
  });

  it("ne conclut rien quand le contrôle n'a rien donné", () => {
    const report = renderClientReport(input({ controlRetrieval: null }));
    expect(report).toMatch(/n'a pas pu être compté sur les offres témoins/);
  });
});

describe("là où ça bloque", () => {
  it("dit en clair l'étape qui bloque, avec le compte brut et sa fourchette", () => {
    const report = renderClientReport(input());
    expect(report).toContain("0 fois sur 200");
    expect(report).toMatch(/\[0,0\u00a0% ; 1,9\u00a0%\]/);
  });

  it("annonce qu'aucune étape ne bloque quand le profil passe partout", () => {
    const passing = [engineFunnel("openai", 200, [120, 100, 90, 80])];
    const plan = correctionPlan({ ...planInput, funnel: passing, sourceShare: {}, refusalRate: {} });
    const report = renderClientReport(input({ funnel: passing, plan, sourceShare: {} }));
    expect(report).toContain("Aucune étape ne bloque");
    expect(report).not.toContain("## Plan de correction");
  });
});

describe("plan de correction", () => {
  it("numérote les actions et donne pour chacune la raison, l'endroit, l'effort et la preuve", () => {
    const report = renderClientReport(input());
    expect(report).toContain("## Plan de correction");
    expect(report).toMatch(/### 1\./);
    for (const label of ["Pourquoi", "Où l'appliquer", "Effort", "Ce qui le montre"]) expect(report).toContain(label);
  });

  it("sépare ce sur quoi le client ne peut rien, sans en faire une action", () => {
    const report = renderClientReport(input());
    const section = report.slice(report.indexOf("## Ce qui ne dépend pas de vous"));
    expect(section).toContain("anthropic");
    expect(section).toContain("28,8\u00a0%");
  });
});

describe("garde-fous", () => {
  it("ne laisse ni point décimal ni date ISO dans un document français", () => {
    const report = renderClientReport(input());
    expect(report).not.toMatch(/\d\.\d\s?%/);
    expect(report).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(report).toContain("Mesure du **24 octobre 2026**");
  });

  it("ne promet jamais un rang, une apparition ni une mission", () => {
    const report = renderClientReport(input());
    expect(report).toMatch(/Aucun rang, aucune apparition, aucun contact et aucune mission ne vous (sont|est) promis/);
    expect(report).not.toMatch(/garanti|vous serez cité|100 % de visibilité/i);
  });

  it("dit que la mesure passe par les API et que les applications peuvent différer", () => {
    expect(renderClientReport(input())).toMatch(/API.*applications|applications.*API/s);
  });

  it("ne contient jamais le nom d'un tiers : seuls des domaines sont cités comme sources", () => {
    const report = renderClientReport(input());
    // Le rapport ne reçoit aucun nom de tiers ; la carte des sources ne parle que de domaines.
    const sources = report.slice(report.indexOf("## Ce que les IA lisent"), report.indexOf("## Plan de correction"));
    for (const line of sources.split("\n").filter((l) => l.startsWith("|") && !l.includes("Source") && !l.includes("---"))) {
      expect(line).toMatch(/\|\s*(`[a-z0-9.-]+`|[^|]*(autres|vos pages))/i);
    }
  });

  it("n'affiche jamais une source comptée comme si elle valait zéro", () => {
    // 1 citation sur 2 330 s'arrondit à 0,0 % : un rapport vendu comme rigoureux ne peut pas afficher un faux zéro.
    const report = renderClientReport(input({ sourceShare: { "malt.fr": 0.39, "rare.example": 1 / 2330 } }));
    expect(report).toMatch(/`rare\.example` \| < 0,1\u00a0%/);
    expect(report).not.toMatch(/`rare\.example` \| 0,0\u00a0%/);
  });

  it("neutralise une valeur qui tenterait de remodeler le document", () => {
    // Défense en profondeur : le schéma refuse déjà ces valeurs, mais cette fonction est appelable directement.
    const report = renderClientReport(
      input({
        jobDescriptions: [{ id: "T01", label: "Dev | cible | fournie par vous", provenance: "proofseen", role: "control" }],
        caveats: ["Réserve\n## Résultat garanti"],
        client: { displayName: "Camille `Dupont`", reference: "FR-1AB2C" },
      }),
    );
    // La cellule forgée ne crée pas de colonnes : les barres sont échappées.
    expect(report).toContain("| Dev \\| cible \\| fournie par vous | choisie par Proofseen | témoin |");
    // Le faux titre ne peut pas exister : il n'y a plus de saut de ligne pour l'ouvrir.
    expect(report).not.toMatch(/^## Résultat garanti/m);
    expect(report).toContain("Camille \\`Dupont\\`");
  });

  it("rend une vague simulée impossible à confondre avec une vraie", () => {
    // Sans cela, le rapport d'un essai à vide est indiscernable d'un vrai, et pourrait être remis à un client payant.
    const report = renderClientReport(input({ simulated: true }));
    expect(report.split("\n")[0]).toContain("SIMULATION");
    expect(report).toContain("ne doit pas être remis à un client");
    expect(report).toContain("aucune IA n'a été interrogée");
  });

  it("ne crie pas à la simulation sur une vraie vague", () => {
    expect(renderClientReport(input())).not.toContain("SIMULATION");
  });

  it("reprend les réserves de la vague telles quelles", () => {
    expect(renderClientReport(input())).toContain("Gemini et Copilot ne sont pas couverts");
  });

  it("refuse de rendre un rapport dont la vague ne porte aucun tirage", () => {
    expect(() => renderClientReport(input({ wave: { ...input().wave, draws: 0 } }))).toThrow(/aucun tirage/);
  });
});

describe("typographie d'un document remis au client (Kensa N5)", () => {
  // Toutes les branches qui écrivaient un tiret cadratin : simulation, contrôle nul ou positif, indexation absente,
  // comparaison où les moteurs ont bougé, plan avec actions. Le rapport se lit sans un seul.
  const variants: readonly ClientReportInput[] = [
    input(),
    input({ simulated: true }),
    input({ controlRetrieval: { p: 0.12, low: 0.07, high: 0.2 }, indexation: null }),
    input({
      comparison: compareWaves({
        before: FUNNEL,
        after: [engineFunnel("openai", 200, [60, 40, 30, 20]), engineFunnel("perplexity", 200, [70, 40, 20, 10])],
        controlDrift: { delta: 0.12, flagged: true },
      }),
    }),
  ];

  it("n'écrit aucun tiret cadratin, ni en Markdown ni en HTML", () => {
    for (const variant of variants) {
      expect(renderClientReport(variant)).not.toContain(String.fromCodePoint(0x2014));
      expect(renderClientReportHtml(variant)).not.toContain(String.fromCodePoint(0x2014));
    }
  });

  it("titre le rapport par le nom du client, après un deux-points insécable, et marque la simulation entre parenthèses", () => {
    expect(renderClientReport(input()).split("\n")[0]).toBe("# Votre visibilité dans les réponses des IA\u202f: Camille Dupont");
    expect(renderClientReport(input({ simulated: true })).split("\n")[0]).toBe("# Votre visibilité dans les réponses des IA\u202f: Camille Dupont (SIMULATION)");
    expect(renderClientReportHtml(input())).toContain("<title>Votre visibilité dans les réponses des IA\u202f: Camille Dupont</title>");
  });

  it("garde chaque chiffre et chaque fourchette, entre parenthèses plutôt qu'après un tiret", () => {
    const report = renderClientReport(input({ controlRetrieval: { p: 0.12, low: 0.07, high: 0.2 } }));
    expect(report).toContain("des réponses (fourchette [7,0\u00a0% ; 20,0\u00a0%]).");
    expect(renderClientReport(input())).toContain("(fourchette [0,0\u00a0% ; 1,9\u00a0%]). C'est le résultat attendu.");
    expect(report).toContain("Modèle interrogé (openai)");
    expect(renderClientReport(input({ indexation: null }))).toContain("**Vos pages sont-elles connues des moteurs ?** Non mesuré pour cette vague.");
    expect(report).toContain("**Vos pages sont-elles connues des moteurs ?** **4 page(s) indexée(s)** sur 4 déclarée(s)");
  });
});
