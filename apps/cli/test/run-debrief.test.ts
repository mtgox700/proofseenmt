import { describe, expect, it } from "vitest";
import { RAW_TTL_MS } from "@proofseen/extract";
import { runDebriefLines } from "../src/commands";

/*
 * Ce que la fin d'une vague doit dire. Sur J0, 780 extractions sur 780 ont échoué sans que rien ne le signale, alors
 * que les réponses brutes s'effacent 72 h plus tard : la vague a failli devenir irrécupérable.
 */

const STARTED = "2026-10-24T08:30:00.000Z";
const DEADLINE = new Date(Date.parse(STARTED) + RAW_TTL_MS).toISOString();
const debrief = (over: Partial<Parameters<typeof runDebriefLines>[0]> = {}) =>
  runDebriefLines({ dryRun: false, waveId: "J30", startedAt: STARTED, draws: 780, failedExtractions: 0, ...over }).join("\n");

describe("une vague saine", () => {
  it("annonce l'échéance de purge, en clair", () => {
    expect(debrief()).toContain(DEADLINE);
    expect(debrief()).toMatch(/72 h.*effacées définitivement/s);
  });

  it("donne la commande exacte de ré-analyse, avec le bon identifiant de vague", () => {
    expect(debrief()).toContain("proofseen extract --identity <identité> --wave J30");
  });

  it("ne crie pas quand il n'y a rien à corriger", () => {
    expect(debrief()).not.toContain("⚠");
  });
});

describe("une vague dont l'extraction a échoué", () => {
  it("crie, compte les tirages touchés, et dit avant quand corriger", () => {
    const out = debrief({ failedExtractions: 780 });
    expect(out).toContain("⚠ EXTRACTION ÉCHOUÉE SUR 780 TIRAGE(S) SUR 780.");
    expect(out).toContain(`Corriger la cause, puis relancer AVANT le ${DEADLINE}`);
  });

  it("explique la conséquence plutôt que de la laisser deviner", () => {
    expect(debrief({ failedExtractions: 14 })).toMatch(/re-scoring déterministe/);
  });

  it("crie dès une seule extraction échouée : un échec partiel se remarque encore moins", () => {
    expect(debrief({ failedExtractions: 1 })).toContain("⚠");
  });
});

describe("un essai à vide", () => {
  it("ne dit rien : il n'a rien produit qu'on puisse ré-analyser, et le bruit cesse d'être lu", () => {
    expect(runDebriefLines({ dryRun: true, waveId: "J30", startedAt: STARTED, draws: 780, failedExtractions: 780 })).toEqual([]);
  });
});
