/*
 * Les taux et seuils du simulateur de revenu net, un par un, chacun avec la page officielle d'où il vient, la date de
 * mise à jour affichée par cette page (« Vérifié le ») et la date à laquelle la War Room l'a lue. Aucun autre chiffre
 * n'entre dans le calcul.
 *
 * À relire quand une fiche change (loi de finances, loi de financement de la sécurité sociale) : changer la valeur, la
 * date de lecture, et RATES_AS_OF. Non lus car inaccessibles (aucun contournement) : urssaf.fr (connexion coupée) et
 * economie.gouv.fr (403), le 17 octobre 2026.
 */

/** La date à laquelle toutes les sources ci-dessous ont été lues : la page dit « taux en vigueur au … ». */
export const RATES_AS_OF = "2026-10-17";

export interface RateSource {
  readonly title: { readonly fr: string; readonly en: string };
  readonly url: string;
  /** Date « Vérifié le » portée par la page officielle. */
  readonly verifiedOn: string;
}

export const SOURCES = {
  microSocial: {
    title: { fr: "Régime micro-social (service-public.fr, fiche F37353)", en: "Micro-social scheme (service-public.fr, sheet F37353)" },
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F37353",
    verifiedOn: "2026-02-21",
  },
  microTax: {
    title: { fr: "Régime fiscal de la micro-entreprise (service-public.fr, fiche F23267)", en: "Tax regime of the micro-enterprise (service-public.fr, sheet F23267)" },
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F23267",
    verifiedOn: "2026-05-13",
  },
  training: {
    title: { fr: "Contribution à la formation professionnelle des entrepreneurs individuels (service-public.fr, fiche F23459)", en: "Vocational training contribution of sole traders (service-public.fr, sheet F23459)" },
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F23459",
    verifiedOn: "2026-01-01",
  },
  incomeTax: {
    title: { fr: "Barème de l'impôt sur le revenu (service-public.fr, fiche F1419)", en: "Income tax brackets (service-public.fr, sheet F1419)" },
    url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F1419",
    verifiedOn: "2026-04-15",
  },
  corporateTax: {
    title: { fr: "Impôt sur les sociétés (service-public.fr, fiche F23575)", en: "Corporate income tax (service-public.fr, sheet F23575)" },
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F23575",
    verifiedOn: "2026-02-17",
  },
  sasuTax: {
    title: { fr: "Fiscalité de la SASU (service-public.fr, fiche F36215)", en: "Taxation of the SASU (service-public.fr, sheet F36215)" },
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F36215",
    verifiedOn: "2026-02-21",
  },
  eurlTax: {
    title: { fr: "Fiscalité de l'EURL (service-public.fr, fiche F36212)", en: "Taxation of the EURL (service-public.fr, sheet F36212)" },
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F36212",
    verifiedOn: "2026-02-21",
  },
  eurlSocial: {
    title: { fr: "Cotisations sociales d'une EURL (service-public.fr, fiche F36239)", en: "Social contributions of an EURL (service-public.fr, sheet F36239)" },
    url: "https://entreprendre.service-public.gouv.fr/vosdroits/F36239",
    verifiedOn: "2026-02-21",
  },
} as const satisfies Record<string, RateSource>;

export type SourceKey = keyof typeof SOURCES;

export interface Sourced {
  readonly value: number;
  readonly source: SourceKey;
  /** Date de lecture de la page par la War Room (AAAA-MM-JJ). */
  readonly readOn: string;
}

/** Les taux sont des fractions (0,256 = 25,6 %), les montants des euros. */
export const RATES = {
  /** Cotisations micro-sociales 2026, professions libérales non réglementées hors Cipav, sur le CA encaissé. */
  microBncSocial: { value: 0.256, source: "microSocial", readOn: "2026-10-17" },
  /** Cotisations micro-sociales 2026, prestations de services BIC, sur le CA encaissé. */
  microBicSocial: { value: 0.212, source: "microSocial", readOn: "2026-10-17" },
  /** Formation professionnelle, activité libérale : part du CA annuel. */
  trainingBnc: { value: 0.002, source: "training", readOn: "2026-10-17" },
  /** Formation professionnelle, activité commerciale : part du CA annuel. */
  trainingBic: { value: 0.001, source: "training", readOn: "2026-10-17" },
  /** Abattement forfaitaire, activité libérale (BNC). */
  allowanceBnc: { value: 0.34, source: "microTax", readOn: "2026-10-17" },
  /** Abattement forfaitaire, prestations de services (BIC). */
  allowanceBic: { value: 0.5, source: "microTax", readOn: "2026-10-17" },
  /** Abattement minimal, en euros. */
  allowanceMinimum: { value: 305, source: "microTax", readOn: "2026-10-17" },
  /** Versement libératoire, BNC, sur le CA HT. */
  flatTaxBnc: { value: 0.022, source: "microTax", readOn: "2026-10-17" },
  /** Versement libératoire, prestations de services commerciales BIC, sur le CA HT. */
  flatTaxBic: { value: 0.017, source: "microTax", readOn: "2026-10-17" },
  /** Revenu fiscal de référence de N-2 sous lequel une personne seule peut opter pour le versement libératoire, en euros. */
  flatTaxIncomeLimitSingle: { value: 29_579, source: "microTax", readOn: "2026-10-17" },
  /** Plafond de CA HT du régime micro, prestations de services BIC et activité libérale (revenus 2026), en euros. */
  microCeilingServices: { value: 83_600, source: "microTax", readOn: "2026-10-17" },
  /** Taux réduit d'impôt sur les sociétés (PME, conditions remplies). */
  corporateReducedRate: { value: 0.15, source: "corporateTax", readOn: "2026-10-17" },
  /** Part du bénéfice au taux réduit, en euros. */
  corporateReducedCeiling: { value: 42_500, source: "corporateTax", readOn: "2026-10-17" },
  /** Chiffre d'affaires HT maximal pour le taux réduit, en euros. */
  corporateReducedTurnoverMax: { value: 10_000_000, source: "corporateTax", readOn: "2026-10-17" },
  /** Part minimale du capital détenue par des personnes physiques pour le taux réduit. */
  corporateReducedOwnership: { value: 0.75, source: "corporateTax", readOn: "2026-10-17" },
  /** Taux normal d'impôt sur les sociétés. */
  corporateNormalRate: { value: 0.25, source: "corporateTax", readOn: "2026-10-17" },
  /** Prélèvement forfaitaire unique sur les dividendes : part impôt sur le revenu. */
  dividendIncomeTax: { value: 0.128, source: "sasuTax", readOn: "2026-10-17" },
  /** Prélèvement forfaitaire unique sur les dividendes : prélèvements sociaux. */
  dividendSocialLevies: { value: 0.186, source: "sasuTax", readOn: "2026-10-17" },
} as const satisfies Record<string, Sourced>;

export interface TaxBracket {
  /** Le taux s'applique à la part du revenu (par part) au-delà de ce montant, en euros. */
  readonly above: number;
  readonly rate: number;
}

/** Barème de l'impôt sur le revenu applicable aux revenus de 2025, le plus récent publié (fiche F1419, lue le 2026-10-17). */
export const INCOME_TAX_BRACKETS = {
  year: 2025,
  source: "incomeTax",
  readOn: "2026-10-17",
  brackets: [
    { above: 11_600, rate: 0.11 },
    { above: 29_579, rate: 0.3 },
    { above: 84_577, rate: 0.41 },
    { above: 181_917, rate: 0.45 },
  ],
} as const satisfies { readonly year: number; readonly source: SourceKey; readonly readOn: string; readonly brackets: readonly TaxBracket[] };
