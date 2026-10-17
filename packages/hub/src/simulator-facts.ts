import { longDate, money, type Lang } from "./market-shell";
import { EXAMPLE_INPUT, simulate, type MicroResult } from "./simulator";
import { INCOME_TAX_BRACKETS, RATES, RATES_AS_OF, SOURCES, type SourceKey } from "./simulator-rates";

/*
 * Ce que la page du simulateur affirme, tiré des seuls taux sourcés et du calcul : le tableau des taux, et la FAQ (en
 * clair dans la page et dans le JSON-LD). Rien n'est écrit qui ne vienne de simulator-rates.ts ou de `simulate`.
 */

const EURO = 100;

export const percent = (rate: number, lang: Lang): string =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", { style: "percent", maximumFractionDigits: 1 }).format(rate);

export const euros = (amount: number, lang: Lang): string => money(amount * EURO, "EUR", lang);

export const asOf = (lang: Lang): string => longDate(new Date(`${RATES_AS_OF}T00:00:00Z`), lang);

export interface RateRow {
  readonly label: string;
  readonly value: string;
  readonly source: SourceKey;
}

type RateKey = keyof typeof RATES;

const RATE_LABELS: Readonly<Record<Lang, Readonly<Record<RateKey, string>>>> = {
  fr: {
    microBncSocial: "Cotisations micro-sociales, profession libérale non réglementée hors Cipav (2026)",
    microBicSocial: "Cotisations micro-sociales, prestations de services BIC (2026)",
    trainingBnc: "Formation professionnelle, activité libérale",
    trainingBic: "Formation professionnelle, activité commerciale",
    allowanceBnc: "Abattement forfaitaire, activité libérale (BNC)",
    allowanceBic: "Abattement forfaitaire, prestations de services (BIC)",
    allowanceMinimum: "Abattement minimal",
    flatTaxBnc: "Versement libératoire, BNC",
    flatTaxBic: "Versement libératoire, prestations de services commerciales BIC",
    flatTaxIncomeLimitSingle: "Revenu fiscal de référence maximal pour le versement libératoire, personne seule",
    microCeilingServices: "Plafond de chiffre d'affaires HT du régime micro, services et activité libérale",
    corporateReducedRate: "Impôt sur les sociétés, taux réduit",
    corporateReducedCeiling: "Bénéfice au taux réduit, jusqu'à",
    corporateReducedTurnoverMax: "Chiffre d'affaires maximal pour le taux réduit",
    corporateReducedOwnership: "Capital détenu par des personnes physiques pour le taux réduit, au moins",
    corporateNormalRate: "Impôt sur les sociétés, taux normal",
    dividendIncomeTax: "Dividendes, prélèvement forfaitaire : impôt sur le revenu",
    dividendSocialLevies: "Dividendes, prélèvement forfaitaire : prélèvements sociaux",
  },
  en: {
    microBncSocial: "Micro-social contributions, non-regulated liberal profession outside Cipav (2026)",
    microBicSocial: "Micro-social contributions, BIC services (2026)",
    trainingBnc: "Vocational training, liberal activity",
    trainingBic: "Vocational training, commercial activity",
    allowanceBnc: "Flat allowance, liberal activity (BNC)",
    allowanceBic: "Flat allowance, services (BIC)",
    allowanceMinimum: "Minimum allowance",
    flatTaxBnc: "Flat income tax payment, BNC",
    flatTaxBic: "Flat income tax payment, BIC commercial services",
    flatTaxIncomeLimitSingle: "Maximum reference income for the flat payment, single person",
    microCeilingServices: "Turnover ceiling (excl. VAT) of the micro regime, services and liberal activity",
    corporateReducedRate: "Corporate tax, reduced rate",
    corporateReducedCeiling: "Profit taxed at the reduced rate, up to",
    corporateReducedTurnoverMax: "Maximum turnover for the reduced rate",
    corporateReducedOwnership: "Capital held by individuals for the reduced rate, at least",
    corporateNormalRate: "Corporate tax, normal rate",
    dividendIncomeTax: "Dividends, flat withholding: income tax",
    dividendSocialLevies: "Dividends, flat withholding: social levies",
  },
};

const AMOUNTS: ReadonlySet<RateKey> = new Set<RateKey>(["allowanceMinimum", "flatTaxIncomeLimitSingle", "microCeilingServices", "corporateReducedCeiling", "corporateReducedTurnoverMax"]);

const BRACKET_LABEL = {
  fr: (year: number, from: string) => `Barème de l'impôt sur le revenu ${year}, par part, au-delà de ${from}`,
  en: (year: number, from: string) => `Income tax brackets ${year}, per share, above ${from}`,
} as const;

/** Chaque taux et seuil utilisé, avec sa source : le tableau « taux en vigueur ». */
export const rateRows = (lang: Lang): readonly RateRow[] => [
  ...(Object.keys(RATES) as RateKey[]).map((key) => ({
    label: RATE_LABELS[lang][key],
    value: AMOUNTS.has(key) ? euros(RATES[key].value, lang) : percent(RATES[key].value, lang),
    source: RATES[key].source,
  })),
  ...INCOME_TAX_BRACKETS.brackets.map((b) => ({ label: BRACKET_LABEL[lang](INCOME_TAX_BRACKETS.year, euros(b.above, lang)), value: percent(b.rate, lang), source: INCOME_TAX_BRACKETS.source })),
];

export interface Faq {
  readonly q: string;
  readonly a: string;
}

const sheet = (key: SourceKey): string => /F\d+$/.exec(SOURCES[key].url)?.[0] ?? "";

/** L'exemple de la page nue, calculé : un micro-entrepreneur BNC. */
export const exampleResult = (): MicroResult => {
  const r = simulate(EXAMPLE_INPUT);
  if (r.kind !== "micro") throw new Error("l'exemple doit être une micro-entreprise");
  return r;
};

export const simulatorFaq = (lang: Lang): readonly Faq[] => {
  const p = (key: RateKey): string => percent(RATES[key].value, lang);
  const amount = (key: RateKey): string => euros(RATES[key].value, lang);
  const pfu = percent(RATES.dividendIncomeTax.value + RATES.dividendSocialLevies.value, lang);
  const ex = exampleResult();
  const exRate = money(EXAMPLE_INPUT.dailyRateCents, "EUR", lang);
  const exExpenses = money(EXAMPLE_INPUT.expensesCents, "EUR", lang);
  const when = asOf(lang);
  if (lang === "fr") {
    return [
      { q: "Quel est le taux de cotisations d'un micro-entrepreneur en 2026 ?", a: `${p("microBncSocial")} du chiffre d'affaires encaissé pour une profession libérale non réglementée hors Cipav, et ${p("microBicSocial")} pour des prestations de services BIC (fiche ${sheet("microSocial")} de service-public.fr).` },
      { q: "Quel abattement s'applique au chiffre d'affaires d'un micro-entrepreneur ?", a: `${p("allowanceBnc")} pour une activité libérale (BNC) et ${p("allowanceBic")} pour des prestations de services (BIC), avec un minimum de ${amount("allowanceMinimum")} (fiche ${sheet("microTax")}).` },
      { q: "Combien coûte le versement libératoire de l'impôt sur le revenu ?", a: `${p("flatTaxBnc")} du chiffre d'affaires HT en BNC et ${p("flatTaxBic")} pour des prestations de services commerciales BIC, si le revenu fiscal de référence de N-2 est inférieur à ${amount("flatTaxIncomeLimitSingle")} pour une personne seule (fiche ${sheet("microTax")}).` },
      { q: "Comment sont imposés les dividendes d'un président de SASU ?", a: `Au prélèvement forfaitaire unique de ${pfu} : ${p("dividendIncomeTax")} d'impôt sur le revenu et ${p("dividendSocialLevies")} de prélèvements sociaux (fiche ${sheet("sasuTax")}).` },
      { q: "Quel est le taux de l'impôt sur les sociétés ?", a: `${p("corporateNormalRate")}, avec un taux réduit de ${p("corporateReducedRate")} jusqu'à ${amount("corporateReducedCeiling")} de bénéfice pour les entreprises qui en remplissent les conditions (fiche ${sheet("corporateTax")}).` },
      {
        q: `Combien reste-t-il avec un TJM de ${exRate} sur ${EXAMPLE_INPUT.days} jours en micro-entreprise BNC ?`,
        a: `Avec ${exExpenses} de frais, selon ce simulateur et les taux en vigueur au ${when} : ${money(ex.netAfterIncomeTaxCents, "EUR", lang)} après impôt au barème (personne seule, 1 part, avant décote), ou ${money(ex.netAfterFlatTaxCents, "EUR", lang)} avec le versement libératoire. Une estimation, pas une promesse.`,
      },
      { q: "Pourquoi l'EURL à l'IS n'est-elle pas simulée ?", a: `Les cotisations du gérant associé sont calculées sur ses revenus professionnels (fiche ${sheet("eurlSocial")}), et leurs taux n'ont pas pu être lus sur une page officielle accessible : aucun chiffre n'est inventé.` },
    ];
  }
  return [
    { q: "What is the contribution rate of a French micro-entrepreneur in 2026?", a: `${p("microBncSocial")} of collected turnover for a non-regulated liberal profession outside Cipav, and ${p("microBicSocial")} for BIC services (service-public.fr sheet ${sheet("microSocial")}).` },
    { q: "Which allowance applies to a micro-entrepreneur's turnover?", a: `${p("allowanceBnc")} for a liberal activity (BNC) and ${p("allowanceBic")} for services (BIC), with a minimum of ${amount("allowanceMinimum")} (sheet ${sheet("microTax")}).` },
    { q: "How much is the flat income tax payment (versement libératoire)?", a: `${p("flatTaxBnc")} of turnover excluding VAT for BNC and ${p("flatTaxBic")} for BIC commercial services, if the household's reference income two years earlier is below ${amount("flatTaxIncomeLimitSingle")} for a single person (sheet ${sheet("microTax")}).` },
    { q: "How are a SASU president's dividends taxed?", a: `At the single flat rate of ${pfu}: ${p("dividendIncomeTax")} income tax and ${p("dividendSocialLevies")} social levies (sheet ${sheet("sasuTax")}).` },
    { q: "What is the French corporate tax rate?", a: `${p("corporateNormalRate")}, with a reduced rate of ${p("corporateReducedRate")} on profit up to ${amount("corporateReducedCeiling")} for companies that meet its conditions (sheet ${sheet("corporateTax")}).` },
    {
      q: `What is left from a ${exRate} day rate over ${EXAMPLE_INPUT.days} days as a BNC micro-entrepreneur?`,
      a: `With ${exExpenses} of expenses, according to this simulator and the rates in force on ${when}: ${money(ex.netAfterIncomeTaxCents, "EUR", lang)} after income tax on the brackets (single person, 1 share, before the décote), or ${money(ex.netAfterFlatTaxCents, "EUR", lang)} with the flat payment. An estimate, not a promise.`,
    },
    { q: "Why is the EURL under corporate tax not simulated?", a: `The managing partner's contributions are computed on their professional income (sheet ${sheet("eurlSocial")}), and their rates could not be read on an accessible official page: no figure is invented.` },
  ];
};
