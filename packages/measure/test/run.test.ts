import { describe, expect, it } from "vitest";
import { configuredEngines, measurementCapUsd, measurementKit, measurementsEnabled, MAX_MEASUREMENT_USD, runMeasurement, subjectOf, type MeasuredProfile } from "../src/index";
import { scriptedTransport, type Client } from "./support/transport";

/*
 * Le moteur de mesure, sans réseau : chaque test passe un transport simulé. Aucune clé réelle, aucun appel payant.
 */

const CLIENT: Client = { name: "Jeanne Dupont", url: "https://jeanne-dupont.example.fr/" };
const NOW = new Date("2026-10-14T10:00:00Z");
const noSleep = async (): Promise<void> => undefined;

const profile = (overrides: Partial<MeasuredProfile & { published: boolean }> = {}): MeasuredProfile & { published: boolean } => ({
  reference: "FR-TQ7MZ",
  displayName: CLIENT.name,
  headline: "Développeuse TypeScript et Node.js",
  city: "Lyon",
  workMode: "remote",
  skills: ["TypeScript", "Node.js", "PostgreSQL"],
  verifiedUrls: [{ url: CLIENT.url, proofMethod: "well_known_file", verifiedAt: NOW }],
  published: true,
  ...overrides,
});

const ONLY_ANTHROPIC = { ANTHROPIC_API_KEY: "test-key-not-real" };
const ALL_ENGINES = { ...ONLY_ANTHROPIC, OPENAI_API_KEY: "test-key-not-real", PERPLEXITY_API_KEY: "test-key-not-real" };

describe("ce qui est demandé aux moteurs", () => {
  it("construit une offre à partir du titre et des compétences, sans jamais nommer la personne", () => {
    const subject = subjectOf(profile());
    if ("refusal" in subject) throw new Error(subject.refusal);
    expect(subject.jobDescription.text).toContain("Développeuse TypeScript et Node.js");
    expect(subject.jobDescription.text).toContain("PostgreSQL");
    expect(subject.jobDescription.text).not.toContain("Dupont");
    expect(subject.identity.nameVariants).toEqual([CLIENT.name]);
    expect(subject.identity.ownedUrls.map((u) => u.url)).toEqual([CLIENT.url]);
  });

  it("écarte un titre qui nomme la personne, et refuse s'il ne reste rien à demander", () => {
    const named = subjectOf(profile({ headline: "Jeanne Dupont, experte TypeScript" }));
    if ("refusal" in named) throw new Error(named.refusal);
    expect(named.jobDescription.text).not.toContain("Jeanne");
    expect(named.jobDescription.text).toContain("TypeScript");
    expect(subjectOf(profile({ headline: "Jeanne Dupont", skills: [] }))).toEqual({ refusal: "identity_in_profile" });
    expect(subjectOf(profile({ headline: null, skills: [] }))).toEqual({ refusal: "nothing_to_ask" });
    expect(subjectOf(profile({ verifiedUrls: [] }))).toEqual({ refusal: "no_proven_url" });
  });
});

describe("moteurs configurés", () => {
  it("n'interroge que les moteurs dont la clé est présente, et exige l'extracteur", () => {
    expect(configuredEngines(ONLY_ANTHROPIC)).toEqual(["anthropic"]);
    expect(configuredEngines({ ...ALL_ENGINES, OPENAI_API_KEY: "  " })).toEqual(["anthropic", "perplexity"]);
    const { transport } = scriptedTransport(CLIENT);
    expect(measurementKit({ OPENAI_API_KEY: "test-key-not-real" }, transport)).toBeNull();
    expect(measurementKit({}, transport)).toBeNull();
  });

  it("une clé ne suffit pas : les mesures payantes attendent l'interrupteur explicite", () => {
    expect(measurementsEnabled(ONLY_ANTHROPIC)).toBe(false);
    expect(measurementsEnabled({ ...ONLY_ANTHROPIC, PROOFSEEN_MEASURE_ENABLED: "0" })).toBe(false);
    expect(measurementsEnabled({ PROOFSEEN_MEASURE_ENABLED: "1" })).toBe(true);
    expect(measurementsEnabled({ PROOFSEEN_MEASURE_ENABLED: " TRUE " })).toBe(true);
  });

  it("le plafond dur couvre le pire cas avec la marge des audits, sous le garde-fou", () => {
    // 1 offre × 4 formulations × 5 tirages = 20 tirages par moteur ; pire cas Anthropic 0,25 $ + extraction 0,006 $.
    expect(measurementCapUsd(["anthropic"])).toBe(5.89);
    expect(measurementCapUsd(["openai", "anthropic", "perplexity"])).toBe(8.7);
    expect(measurementCapUsd(["openai", "anthropic", "perplexity"])).toBeLessThanOrEqual(MAX_MEASUREMENT_USD);
  });
});

describe("une mesure en mémoire", () => {
  it("donne l'entonnoir calculé à la main, sur le seul moteur configuré", async () => {
    const sim = scriptedTransport(CLIENT);
    const kit = measurementKit(ONLY_ANTHROPIC, sim.transport, noSleep);
    if (kit === null) throw new Error("kit absent");
    const outcome = await runMeasurement({ profile: profile(), kit, now: () => NOW });
    if (outcome.kind !== "measured") throw new Error(outcome.kind);

    expect(outcome.engines).toEqual(["anthropic"]);
    expect(sim.calls).toEqual({ openai: 0, anthropic: 20, perplexity: 0 });
    expect(sim.extractions.count).toBe(20);
    // P1 ×5 : tout ; P2 ×5 : retrouvée ; P3 ×5 : retrouvée et nommée (6e) ; P4 ×5 : rien.
    expect(outcome.funnel.map(({ engine, draws, retrieved, named, top5, cited }) => ({ engine, draws, retrieved: retrieved.successes, named: named.successes, top5: top5.successes, cited: cited.successes }))).toEqual([
      { engine: "anthropic", draws: 20, retrieved: 15, named: 10, top5: 5, cited: 5 },
    ]);
    expect(outcome).toMatchObject({ draws: 20, attempted: 20, errors: 0, stoppedReason: null });
    // Par tirage : 3 000 × 2e-6 + 400 × 10e-6 + 1 recherche × 0,01 = 0,02 $, plus 0,006 $ d'extraction.
    expect(outcome.spentUsd).toBeCloseTo(20 * 0.026, 6);
  });

  it("mesure les trois moteurs quand les trois clés sont là ; un moteur en panne compte en erreur, pas en zéro", async () => {
    const sim = scriptedTransport(CLIENT, { failing: ["openai"] });
    const kit = measurementKit(ALL_ENGINES, sim.transport, noSleep);
    if (kit === null) throw new Error("kit absent");
    const outcome = await runMeasurement({ profile: profile(), kit, now: () => NOW });
    if (outcome.kind !== "measured") throw new Error(outcome.kind);
    expect(outcome.engines).toEqual(["openai", "anthropic", "perplexity"]);
    expect(outcome.funnel.map((f) => [f.engine, f.draws, f.retrieved.successes, f.named.successes, f.top5.successes, f.cited.successes])).toEqual([
      ["anthropic", 20, 15, 10, 5, 5],
      ["perplexity", 20, 15, 10, 5, 5],
    ]);
    expect(outcome).toMatchObject({ draws: 40, attempted: 60, errors: 20 });
  });

  it("s'arrête au plafond dur quand les tirages coûtent plus que leur pire cas", async () => {
    // 30 000 jetons de sortie : 0,316 $ le tirage, au-dessus de la borne de 0,25 $.
    const sim = scriptedTransport(CLIENT, { usage: { input_tokens: 3000, output_tokens: 30_000 } });
    const kit = measurementKit(ONLY_ANTHROPIC, sim.transport, noSleep);
    if (kit === null) throw new Error("kit absent");
    const outcome = await runMeasurement({ profile: profile(), kit, now: () => NOW });
    if (outcome.kind !== "measured") throw new Error(outcome.kind);
    expect(outcome.stoppedReason).toMatch(/budget cap reached/);
    expect(outcome.attempted).toBeLessThan(20);
    expect(sim.calls.anthropic).toBe(outcome.attempted);
    // Aucune étape ne part sans que son pire cas tienne sous le plafond : le dépassement se limite à l'écart des tirages déjà payés.
    expect(outcome.spentUsd).toBeLessThanOrEqual(measurementCapUsd(["anthropic"]) + outcome.attempted * (0.322 - 0.256));
  });

  it("refuse avant toute dépense un profil dépublié ou sans adresse prouvée", async () => {
    const sim = scriptedTransport(CLIENT);
    const kit = measurementKit(ONLY_ANTHROPIC, sim.transport, noSleep);
    if (kit === null) throw new Error("kit absent");
    expect(await runMeasurement({ profile: profile({ published: false }), kit, now: () => NOW })).toEqual({ kind: "refused", code: "not_published" });
    expect(await runMeasurement({ profile: profile({ verifiedUrls: [] }), kit, now: () => NOW })).toEqual({ kind: "refused", code: "no_proven_url" });
    expect(sim.calls.anthropic + sim.extractions.count).toBe(0);
  });
});
