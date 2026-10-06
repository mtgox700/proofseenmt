import { describe, expect, it } from "vitest";
import { wilson, type Engine, type EngineFunnel } from "@proofseen/stats";
import { MEANINGFUL_DELTA, compareWaves } from "../src/comparison";

const stage = (successes: number, draws: number) => ({ successes, interval: wilson(successes, draws) });
const funnel = (name: Engine, draws: number, [e2, e3, e4, e5]: readonly number[]): EngineFunnel[] => [
  { engine: name, draws, retrieved: stage(e2!, draws), named: stage(e3!, draws), top5: stage(e4!, draws), cited: stage(e5!, draws) },
];

const steady = { delta: 0.01, flagged: false };
const drifting = { delta: 0.12, flagged: true };

describe("ce que la comparaison autorise à dire", () => {
  it("attribue l'écart au client quand lui seul a bougé", () => {
    const result = compareWaves({ before: funnel("openai", 200, [10, 5, 2, 1]), after: funnel("openai", 200, [60, 40, 30, 20]), controlDrift: steady });
    expect(result.verdict).toBe("attributable");
  });

  it("refuse de l'attribuer quand les moteurs ont bougé aussi", () => {
    // Les témoins ne correspondent au client ni avant ni après : s'ils bougent, ce sont les moteurs.
    const result = compareWaves({ before: funnel("openai", 200, [10, 5, 2, 1]), after: funnel("openai", 200, [60, 40, 30, 20]), controlDrift: drifting });
    expect(result.verdict).toBe("confounded");
  });

  it("ne raconte rien quand rien n'a bougé de façon lisible", () => {
    const result = compareWaves({ before: funnel("openai", 200, [10, 5, 2, 1]), after: funnel("openai", 200, [12, 6, 3, 1]), controlDrift: steady });
    expect(result.verdict).toBe("flat");
  });

  it("n'attribue rien quand la dérive n'a pas pu être mesurée", () => {
    const result = compareWaves({ before: funnel("openai", 200, [10, 5, 2, 1]), after: funnel("openai", 200, [60, 40, 30, 20]), controlDrift: null });
    expect(result.verdict).toBe("unknown");
  });

  it("ne prend pas un écart minuscule pour un mouvement", () => {
    const small = Math.floor((MEANINGFUL_DELTA - 0.005) * 200);
    const result = compareWaves({ before: funnel("openai", 200, [10, 5, 2, 1]), after: funnel("openai", 200, [10 + small, 5, 2, 1]), controlDrift: steady });
    expect(result.verdict).toBe("flat");
  });

  it("voit aussi une baisse, pas seulement une hausse", () => {
    const result = compareWaves({ before: funnel("openai", 200, [60, 40, 30, 20]), after: funnel("openai", 200, [10, 5, 2, 1]), controlDrift: steady });
    expect(result.verdict).toBe("attributable");
    expect(result.stages.find((s) => s.stage === "retrieved")!.delta).toBeLessThan(0);
  });
});

describe("les chiffres de la comparaison", () => {
  it("donne le compte brut avant et après pour chaque étape", () => {
    const result = compareWaves({ before: funnel("openai", 200, [10, 5, 2, 1]), after: funnel("openai", 400, [60, 40, 30, 20]), controlDrift: steady });
    const retrieved = result.stages.find((s) => s.stage === "retrieved")!;
    expect(retrieved.before).toEqual({ successes: 10, draws: 200 });
    expect(retrieved.after).toEqual({ successes: 60, draws: 400 });
    // 60/400 = 15 %, 10/200 = 5 % → +10 points, et non « +50 citations ».
    expect(retrieved.delta).toBeCloseTo(0.1, 6);
  });

  it("couvre les quatre étapes", () => {
    const result = compareWaves({ before: funnel("openai", 200, [10, 5, 2, 1]), after: funnel("openai", 200, [20, 10, 4, 2]), controlDrift: steady });
    expect(result.stages.map((s) => s.stage)).toEqual(["retrieved", "named", "top5", "cited"]);
  });

  it("refuse de comparer quand une des deux mesures est vide", () => {
    expect(() => compareWaves({ before: [], after: funnel("openai", 200, [1, 1, 1, 1]), controlDrift: steady })).toThrow(/comparaison impossible/);
  });
});
