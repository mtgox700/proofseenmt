import { z } from "zod";
import { INCOME_TAX_BRACKETS, RATES, type TaxBracket } from "./simulator-rates";

/*
 * Simulateur de revenu net d'un freelance : des fonctions pures, en centimes, qui n'utilisent que les taux sourcés de
 * simulator-rates.ts. Chaque ligne est arrondie au centime ; la page arrondit à l'euro pour l'affichage.
 *
 * Statuts simulés, et seulement eux :
 *  - micro-entreprise, profession libérale non réglementée (BNC, hors Cipav) ;
 *  - micro-entreprise, prestations de services commerciales (BIC) ;
 *  - SASU à l'IS sous une hypothèse écrite sur la page : aucune rémunération du président, tout le bénéfice distribué
 *    en dividendes, au prélèvement forfaitaire unique. Le partage rémunération / dividendes dépend de choix qu'on ne
 *    peut pas modéliser honnêtement ici.
 * L'EURL à l'IS n'est pas simulée : ses dividendes au-delà d'une part du capital supportent des cotisations dont les
 * taux n'ont pas pu être lus sur une page officielle (voir la page).
 */

export const SIMULATOR_STATUSES = ["micro-bnc", "micro-bic", "sasu-dividendes"] as const;
export type SimulatorStatus = (typeof SIMULATOR_STATUSES)[number];

export interface SimulatorInput {
  readonly dailyRateCents: number;
  readonly days: number;
  readonly status: SimulatorStatus;
  readonly expensesCents: number;
}

export interface MicroResult {
  readonly kind: "micro";
  readonly status: "micro-bnc" | "micro-bic";
  readonly turnoverCents: number;
  readonly socialCents: number;
  readonly trainingCents: number;
  readonly expensesCents: number;
  /** Ce qui reste avant impôt sur le revenu : CA − cotisations − formation − frais. */
  readonly netBeforeTaxCents: number;
  readonly allowanceCents: number;
  readonly taxableCents: number;
  /** Impôt au barème, personne seule (1 part), sans autre revenu, avant décote, réductions et crédits. */
  readonly incomeTaxCents: number;
  readonly netAfterIncomeTaxCents: number;
  /** Versement libératoire, si le foyer y a droit. */
  readonly flatTaxCents: number;
  readonly netAfterFlatTaxCents: number;
  /** Le CA dépasse le plafond du régime micro. */
  readonly aboveCeiling: boolean;
}

export interface SasuResult {
  readonly kind: "sasu";
  readonly status: "sasu-dividendes";
  readonly turnoverCents: number;
  readonly expensesCents: number;
  readonly profitCents: number;
  readonly corporateTaxCents: number;
  readonly dividendsCents: number;
  readonly socialLeviesCents: number;
  readonly dividendIncomeTaxCents: number;
  readonly netCents: number;
}

export type SimulatorResult = MicroResult | SasuResult;

const EURO = 100;
const share = (cents: number, rate: number): number => Math.round(cents * rate);

/** Impôt au barème pour un revenu imposable donné et un nombre de parts (quotient familial), en centimes. */
export const progressiveTax = (taxableCents: number, parts = 1, brackets: readonly TaxBracket[] = INCOME_TAX_BRACKETS.brackets): number => {
  if (taxableCents <= 0 || parts <= 0) return 0;
  const perPart = taxableCents / parts;
  const tax = brackets.reduce((sum, bracket, i) => {
    const lower = bracket.above * EURO;
    const next = brackets[i + 1];
    const upper = next === undefined ? Number.POSITIVE_INFINITY : next.above * EURO;
    return perPart > lower ? sum + (Math.min(perPart, upper) - lower) * bracket.rate : sum;
  }, 0);
  return Math.round(tax * parts);
};

const micro = (input: SimulatorInput & { readonly status: "micro-bnc" | "micro-bic" }): MicroResult => {
  const bnc = input.status === "micro-bnc";
  const turnoverCents = input.dailyRateCents * input.days;
  const socialCents = share(turnoverCents, (bnc ? RATES.microBncSocial : RATES.microBicSocial).value);
  const trainingCents = share(turnoverCents, (bnc ? RATES.trainingBnc : RATES.trainingBic).value);
  const netBeforeTaxCents = turnoverCents - socialCents - trainingCents - input.expensesCents;
  const rawAllowance = Math.max(share(turnoverCents, (bnc ? RATES.allowanceBnc : RATES.allowanceBic).value), RATES.allowanceMinimum.value * EURO);
  const allowanceCents = Math.min(rawAllowance, turnoverCents);
  const taxableCents = turnoverCents - allowanceCents;
  const incomeTaxCents = progressiveTax(taxableCents);
  const flatTaxCents = share(turnoverCents, (bnc ? RATES.flatTaxBnc : RATES.flatTaxBic).value);
  return {
    kind: "micro",
    status: input.status,
    turnoverCents,
    socialCents,
    trainingCents,
    expensesCents: input.expensesCents,
    netBeforeTaxCents,
    allowanceCents,
    taxableCents,
    incomeTaxCents,
    netAfterIncomeTaxCents: netBeforeTaxCents - incomeTaxCents,
    flatTaxCents,
    netAfterFlatTaxCents: netBeforeTaxCents - flatTaxCents,
    aboveCeiling: turnoverCents > RATES.microCeilingServices.value * EURO,
  };
};

/** Impôt sur les sociétés : taux réduit jusqu'au plafond, taux normal au-delà (conditions du taux réduit supposées remplies). */
export const corporateTax = (profitCents: number): number => {
  if (profitCents <= 0) return 0;
  const ceiling = RATES.corporateReducedCeiling.value * EURO;
  return share(Math.min(profitCents, ceiling), RATES.corporateReducedRate.value) + share(Math.max(profitCents - ceiling, 0), RATES.corporateNormalRate.value);
};

const sasu = (input: SimulatorInput): SasuResult => {
  const turnoverCents = input.dailyRateCents * input.days;
  const profitCents = turnoverCents - input.expensesCents;
  const corporateTaxCents = corporateTax(profitCents);
  const dividendsCents = Math.max(profitCents - corporateTaxCents, 0);
  const socialLeviesCents = share(dividendsCents, RATES.dividendSocialLevies.value);
  const dividendIncomeTaxCents = share(dividendsCents, RATES.dividendIncomeTax.value);
  return {
    kind: "sasu",
    status: "sasu-dividendes",
    turnoverCents,
    expensesCents: input.expensesCents,
    profitCents,
    corporateTaxCents,
    dividendsCents,
    socialLeviesCents,
    dividendIncomeTaxCents,
    netCents: dividendsCents - socialLeviesCents - dividendIncomeTaxCents,
  };
};

export const simulate = (input: SimulatorInput): SimulatorResult =>
  input.status === "sasu-dividendes" ? sasu(input) : micro({ ...input, status: input.status });

// ─── Lecture du formulaire (GET, sans JavaScript) ────────────────────────────────────────────────────────────────────

export const LIMITS = { dailyRateMax: 10_000, daysMax: 365, expensesMax: 10_000_000 } as const;

/** L'exemple affiché sur la page nue : un CA sous le plafond du régime micro. */
export const EXAMPLE_INPUT: SimulatorInput = { dailyRateCents: 450 * EURO, days: 180, status: "micro-bnc", expensesCents: 2_000 * EURO };

const wholeEuros = (max: number, min: number) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,8}$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

const QuerySchema = z.object({
  tjm: wholeEuros(LIMITS.dailyRateMax, 1),
  jours: wholeEuros(LIMITS.daysMax, 1),
  statut: z.enum(SIMULATOR_STATUSES),
  frais: z.string().trim().transform((v) => (v === "" ? "0" : v)).pipe(wholeEuros(LIMITS.expensesMax, 0)),
});

export type SimulatorField = keyof z.input<typeof QuerySchema>;
export const SIMULATOR_FIELDS: readonly SimulatorField[] = ["tjm", "jours", "statut", "frais"];

export type SimulatorQuery =
  /** Aucun champ : la page nue, avec son exemple. */
  | { readonly kind: "empty" }
  | { readonly kind: "ok"; readonly input: SimulatorInput; readonly typed: Readonly<Record<SimulatorField, string>> }
  | { readonly kind: "invalid"; readonly fields: readonly SimulatorField[]; readonly typed: Readonly<Record<SimulatorField, string>> };

const MAX_TYPED = 40;

/** Lit les paramètres du formulaire. Un champ faux est signalé, jamais deviné. */
export const parseSimulatorQuery = (params: URLSearchParams): SimulatorQuery => {
  if (!SIMULATOR_FIELDS.some((f) => params.has(f))) return { kind: "empty" };
  const typed = Object.fromEntries(SIMULATOR_FIELDS.map((f) => [f, (params.get(f) ?? "").slice(0, MAX_TYPED)])) as Record<SimulatorField, string>;
  const parsed = QuerySchema.safeParse(typed);
  if (!parsed.success) {
    const fields = SIMULATOR_FIELDS.filter((f) => parsed.error.issues.some((issue) => issue.path[0] === f));
    return { kind: "invalid", fields, typed };
  }
  const { tjm, jours, statut, frais } = parsed.data;
  return { kind: "ok", typed, input: { dailyRateCents: tjm * EURO, days: jours, status: statut, expensesCents: frais * EURO } };
};
