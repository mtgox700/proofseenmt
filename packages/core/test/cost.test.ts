import { describe, expect, it } from "vitest";
import { ManifestSchema } from "../src/schemas";
import { AUDIT_PROTOCOL, OBSERVED_DRAW_USD, WORST_CASE_DRAW_USD, drawsOf, estimatedCostUsd, worstCaseUsd } from "../src/protocol";

/*
 * Le coût d'une vague, éprouvé sur les chiffres de la première vague réelle (`AUDIT-FR-ZK7M4`, 2026-10-02) :
 * 240 tirages, 80 par moteur, 6,279 $ dépensés.
 *
 * Deux défauts y ont été trouvés, et ces tests existent pour qu'ils ne reviennent pas.
 *
 *  1. **Une seule constante de coût pour trois moteurs.** Le coût réel va de 1 à 4 entre Perplexity et Anthropic. Une
 *     moyenne globale n'est exacte que si la composition ne change jamais — elle change dès qu'on mesure sur deux
 *     moteurs, et le chiffre annoncé au client devient faux.
 *  2. **Une borne « pire cas » qui n'en était pas une.** Celle d'Anthropic valait 0,12 $ et a été dépassée 4 fois sur
 *     80, maximum 0,1885 $. Le plafond dur est calculé dessus : sous-estimée, elle laisse la vague s'arrêter en cours
 *     de route — et une vague tronquée porte moins de tirages que son manifeste figé n'en déclare.
 */

const jd = (id: string, role: "target" | "control") => ({ id, lang: "fr", source: "market", role, text: `Offre ${id}`.padEnd(60, " ."), brief: "Une mission en une phrase." });

const manifest = (engines: readonly string[]) =>
  ManifestSchema.parse({
    version: 1,
    waveId: "COUT",
    engines,
    models: Object.fromEntries(engines.map((engine) => [engine, AUDIT_PROTOCOL.models[engine as "openai"]])),
    prompts: AUDIT_PROTOCOL.prompts,
    drawsPerCell: 5,
    jobDescriptions: [jd("T01", "target"), jd("T02", "target"), jd("T03", "target"), jd("C01", "control")],
    frozenAt: null,
    costCapUsd: 400,
  });

describe("le coût estimé suit la composition de la vague", () => {
  it("retrouve le coût réellement dépensé lors de la première vague, à 5 % près", () => {
    // 240 tirages sur les trois moteurs ont coûté 6,279 $. L'ancienne constante unique annonçait 4,92 $.
    const wave = manifest(["openai", "anthropic", "perplexity"]);
    expect(drawsOf(wave)).toBe(240);
    expect(estimatedCostUsd(wave)).toBeGreaterThan(6.279 * 0.95);
    expect(estimatedCostUsd(wave)).toBeLessThan(6.279 * 1.05);
  });

  it("change quand les moteurs changent, au lieu de rester sur une moyenne", () => {
    // Le défaut d'origine : à nombre de tirages égal, l'ancienne formule donnait le même prix pour des vagues qui
    // n'ont rien à voir. Mesurer sur Perplexity seul ne coûte pas ce que coûte Anthropic seul.
    const cher = estimatedCostUsd(manifest(["anthropic"]));
    const bonMarche = estimatedCostUsd(manifest(["perplexity"]));
    expect(drawsOf(manifest(["anthropic"]))).toBe(drawsOf(manifest(["perplexity"])));
    expect(cher).toBeGreaterThan(bonMarche * 3);
  });

  it("reste proportionnel au nombre de tirages", () => {
    const un = manifest(["openai"]);
    expect(estimatedCostUsd(un)).toBeCloseTo(drawsOf(un) * OBSERVED_DRAW_USD.openai, 6);
  });
});

describe("la borne du pire cas doit rester une borne", () => {
  it("couvre le maximum réellement observé sur chaque moteur", () => {
    // Maximums relevés sur les 240 tirages réels. Une borne en dessous laisserait le plafond tronquer la vague.
    const observés = { openai: 0.0433, anthropic: 0.1885, perplexity: 0.0124 } as const;
    for (const [engine, max] of Object.entries(observés)) {
      expect(WORST_CASE_DRAW_USD[engine as "openai"]).toBeGreaterThan(max);
    }
  });

  it("reste au-dessus du coût moyen constaté, sur chaque moteur", () => {
    for (const engine of AUDIT_PROTOCOL.engines) {
      expect(WORST_CASE_DRAW_USD[engine]).toBeGreaterThan(OBSERVED_DRAW_USD[engine]);
    }
  });

  it("majore toujours l'estimation : un plafond calculé sous l'attendu n'a aucun sens", () => {
    const wave = manifest(["openai", "anthropic", "perplexity"]);
    expect(worstCaseUsd(wave)).toBeGreaterThan(estimatedCostUsd(wave));
  });
});
