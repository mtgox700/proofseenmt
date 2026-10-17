import { describe, expect, it } from "vitest";
import { corporateTax, EXAMPLE_INPUT, parseSimulatorQuery, progressiveTax, simulate, type SimulatorInput } from "../src/simulator";
import { INCOME_TAX_BRACKETS, RATES, RATES_AS_OF, SOURCES } from "../src/simulator-rates";

/*
 * Le calcul, contre des exemples faits à la main (en centimes) à partir des taux des fiches officielles lues le
 * 17 octobre 2026. Si un taux change, ces exemples doivent être refaits à la main, pas recopiés depuis le code.
 */

const input = (tjm: number, days: number, status: SimulatorInput["status"], expenses: number): SimulatorInput => ({
  dailyRateCents: tjm * 100,
  days,
  status,
  expensesCents: expenses * 100,
});

describe("taux sourcés", () => {
  it("chaque taux a une source officielle et une date de lecture", () => {
    for (const rate of Object.values(RATES)) {
      expect(SOURCES[rate.source].url).toMatch(/^https:\/\/(entreprendre\.)?service-public\.gouv\.fr\/(vosdroits|particuliers\/vosdroits)\/F\d+$/);
      expect(rate.readOn).toBe(RATES_AS_OF);
    }
    expect(INCOME_TAX_BRACKETS.readOn).toBe(RATES_AS_OF);
    for (const s of Object.values(SOURCES)) expect(s.verifiedOn).toMatch(/^2026-\d{2}-\d{2}$/);
  });
});

describe("barème de l'impôt sur le revenu", () => {
  it("rien sous le seuil de la première tranche", () => {
    expect(progressiveTax(0)).toBe(0);
    expect(progressiveTax(1_160_000)).toBe(0);
  });

  it("calcule tranche par tranche, par part", () => {
    // 47 520 € : 17 979 × 11 % + 17 941 × 30 % = 1 977,69 + 5 382,30.
    expect(progressiveTax(4_752_000)).toBe(735_999);
    // 60 000 € pour deux parts : 30 000 € par part → 1 977,69 + 421 × 30 % = 2 103,99 ; × 2.
    expect(progressiveTax(6_000_000, 2)).toBe(420_798);
    // 200 000 € : les quatre tranches.
    expect(progressiveTax(20_000_000)).toBe(197_769 + 1_649_940 + 3_990_940 + 813_735);
  });
});

describe("micro-entreprise", () => {
  it("BNC : TJM 400 €, 180 jours, 2 000 € de frais", () => {
    expect(simulate(input(400, 180, "micro-bnc", 2_000))).toEqual({
      kind: "micro",
      status: "micro-bnc",
      turnoverCents: 7_200_000,
      socialCents: 1_843_200, // 25,6 %
      trainingCents: 14_400, // 0,2 %
      expensesCents: 200_000,
      netBeforeTaxCents: 5_142_400,
      allowanceCents: 2_448_000, // 34 %
      taxableCents: 4_752_000,
      incomeTaxCents: 735_999,
      netAfterIncomeTaxCents: 4_406_401,
      flatTaxCents: 158_400, // 2,2 %
      netAfterFlatTaxCents: 4_984_000,
      aboveCeiling: false,
    });
  });

  it("BIC services : TJM 300 €, 100 jours, sans frais", () => {
    expect(simulate(input(300, 100, "micro-bic", 0))).toMatchObject({
      turnoverCents: 3_000_000,
      socialCents: 636_000, // 21,2 %
      trainingCents: 3_000, // 0,1 %
      netBeforeTaxCents: 2_361_000,
      allowanceCents: 1_500_000, // 50 %
      taxableCents: 1_500_000,
      incomeTaxCents: 37_400, // 3 400 × 11 %
      netAfterIncomeTaxCents: 2_323_600,
      flatTaxCents: 51_000, // 1,7 %
      netAfterFlatTaxCents: 2_310_000,
    });
  });

  it("abattement d'au moins 305 €, jamais plus que le chiffre d'affaires", () => {
    expect(simulate(input(10, 50, "micro-bnc", 0))).toMatchObject({ turnoverCents: 50_000, allowanceCents: 30_500, taxableCents: 19_500, incomeTaxCents: 0 });
    expect(simulate(input(2, 100, "micro-bnc", 0))).toMatchObject({ turnoverCents: 20_000, allowanceCents: 20_000, taxableCents: 0 });
  });

  it("signale un chiffre d'affaires au-dessus du plafond de 83 600 €", () => {
    expect(simulate(input(418, 200, "micro-bnc", 0))).toMatchObject({ turnoverCents: 8_360_000, aboveCeiling: false });
    expect(simulate(input(500, 200, "micro-bnc", 0))).toMatchObject({ aboveCeiling: true });
  });

  it("l'exemple de la page", () => {
    expect(simulate(EXAMPLE_INPUT)).toMatchObject({ turnoverCents: 8_100_000, netBeforeTaxCents: 5_810_200, taxableCents: 5_346_000, incomeTaxCents: 914_199, netAfterIncomeTaxCents: 4_896_001, netAfterFlatTaxCents: 5_632_000 });
  });
});

describe("SASU, tout en dividendes", () => {
  it("impôt sur les sociétés à 15 % puis 25 %, prélèvement forfaitaire de 12,8 % + 18,6 %", () => {
    expect(corporateTax(4_250_000)).toBe(637_500);
    expect(simulate(input(600, 200, "sasu-dividendes", 10_000))).toEqual({
      kind: "sasu",
      status: "sasu-dividendes",
      turnoverCents: 12_000_000,
      expensesCents: 1_000_000,
      profitCents: 11_000_000,
      corporateTaxCents: 2_325_000, // 42 500 × 15 % + 67 500 × 25 %
      dividendsCents: 8_675_000,
      socialLeviesCents: 1_613_550,
      dividendIncomeTaxCents: 1_110_400,
      netCents: 5_951_050,
    });
  });

  it("une perte ne donne ni impôt ni dividende", () => {
    expect(simulate(input(100, 10, "sasu-dividendes", 2_000))).toMatchObject({ profitCents: -100_000, corporateTaxCents: 0, dividendsCents: 0, netCents: 0 });
  });
});

describe("lecture du formulaire", () => {
  const q = (s: string) => parseSimulatorQuery(new URLSearchParams(s));

  it("sans aucun champ : la page nue", () => {
    expect(q("")).toEqual({ kind: "empty" });
    expect(q("utm_source=x")).toEqual({ kind: "empty" });
  });

  it("lit des euros entiers, des frais vides comme zéro", () => {
    expect(q("tjm=550&jours=200&statut=sasu-dividendes&frais=")).toMatchObject({
      kind: "ok",
      input: { dailyRateCents: 55_000, days: 200, status: "sasu-dividendes", expensesCents: 0 },
    });
  });

  it("signale chaque champ faux, sans rien deviner", () => {
    expect(q("tjm=abc&jours=0&statut=eurl&frais=-5")).toMatchObject({ kind: "invalid", fields: ["tjm", "jours", "statut", "frais"] });
    expect(q("tjm=1e3&jours=366&statut=micro-bnc&frais=0")).toMatchObject({ kind: "invalid", fields: ["tjm", "jours"] });
    expect(q("tjm=10001&jours=200&statut=micro-bnc&frais=10000001")).toMatchObject({ kind: "invalid", fields: ["tjm", "frais"] });
  });

  it("borne ce qu'il garde de la saisie", () => {
    const r = q(`tjm=${"9".repeat(500)}&jours=1&statut=micro-bnc`);
    expect(r.kind).toBe("invalid");
    if (r.kind === "invalid") expect(r.typed.tjm.length).toBeLessThanOrEqual(40);
  });
});
