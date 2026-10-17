import type { Lang } from "./market-shell";
import type { SimulatorField, SimulatorStatus } from "./simulator";

/*
 * Le texte du simulateur, en français et en anglais. Aucun chiffre n'est écrit ici : les taux arrivent en paramètres,
 * déjà formatés, depuis simulator-rates.ts, et les montants depuis le calcul.
 */

export interface SimulatorCopy {
  readonly title: string;
  readonly description: string;
  readonly lead: string;
  readonly formTitle: string;
  readonly fields: Readonly<Record<SimulatorField, string>>;
  readonly hints: Readonly<Record<SimulatorField, string>>;
  readonly submit: string;
  readonly invalid: string;
  readonly statuses: Readonly<Record<SimulatorStatus, string>>;
  readonly resultTitle: string;
  readonly example: (rate: string, days: number, status: string, expenses: string) => string;
  readonly yours: (rate: string, days: number, status: string, expenses: string) => string;
  readonly micro: {
    readonly turnover: string;
    readonly social: (rate: string) => string;
    readonly training: (rate: string) => string;
    readonly expenses: string;
    readonly beforeTax: string;
    readonly optionScale: string;
    readonly taxable: (rate: string, minimum: string) => string;
    readonly incomeTax: (year: number) => string;
    readonly afterIncomeTax: string;
    readonly optionFlat: (limit: string) => string;
    readonly flatTax: (rate: string) => string;
    readonly afterFlatTax: string;
    readonly ceiling: (ceiling: string) => string;
  };
  readonly sasu: {
    readonly turnover: string;
    readonly expenses: string;
    readonly profit: string;
    readonly corporateTax: (reduced: string, ceiling: string, normal: string) => string;
    readonly dividends: string;
    readonly levies: (rate: string) => string;
    readonly dividendTax: (rate: string) => string;
    readonly net: string;
  };
  readonly assumptionsTitle: string;
  readonly common: readonly string[];
  readonly microAssumptions: (ceiling: string, year: number) => readonly string[];
  readonly sasuAssumptions: (turnoverMax: string, ownership: string) => readonly string[];
  readonly notSimulatedTitle: string;
  readonly eurl: string;
  readonly ratesTitle: (asOf: string) => string;
  readonly rateHeaders: readonly [string, string, string];
  readonly verified: (date: string) => string;
  readonly faqTitle: string;
  readonly disclaimer: string;
}

export const SIMULATOR_COPY: Readonly<Record<Lang, SimulatorCopy>> = {
  fr: {
    title: "Simulateur de revenu net d'un freelance",
    description: "Estimez votre revenu net de freelance à partir de votre TJM, de vos jours facturés, de votre statut et de vos frais, avec les taux officiels et leurs sources.",
    lead: "Estimez ce qui vous reste à partir de votre TJM, de vos jours facturés, de votre statut et de vos frais. Chaque taux vient d'une page officielle, citée plus bas. C'est une estimation : ni un conseil, ni une promesse de résultat.",
    formTitle: "Vos chiffres",
    fields: { tjm: "TJM (€ HT par jour)", jours: "Jours facturés par an", statut: "Statut", frais: "Frais annuels (€)" },
    hints: { tjm: "Un nombre entier, de 1 à 10 000.", jours: "Un nombre entier, de 1 à 365.", statut: "Choisissez un des statuts simulés.", frais: "Un nombre entier, 0 si vous n'en avez pas." },
    submit: "Calculer",
    invalid: "Certains champs ne sont pas lisibles : rien n'est calculé tant qu'ils ne le sont pas.",
    statuses: {
      "micro-bnc": "Micro-entreprise, profession libérale non réglementée (BNC, hors Cipav)",
      "micro-bic": "Micro-entreprise, prestations de services commerciales (BIC)",
      "sasu-dividendes": "SASU à l'IS, sans rémunération, bénéfice distribué en dividendes",
    },
    resultTitle: "Résultat",
    example: (rate, days, status, expenses) => `Exemple : ${rate} par jour, ${days} jours, ${status}, ${expenses} de frais.`,
    yours: (rate, days, status, expenses) => `Votre simulation : ${rate} par jour, ${days} jours, ${status}, ${expenses} de frais.`,
    micro: {
      turnover: "Chiffre d'affaires (TJM × jours)",
      social: (rate) => `Cotisations sociales (${rate} du chiffre d'affaires)`,
      training: (rate) => `Contribution à la formation professionnelle (${rate} du chiffre d'affaires)`,
      expenses: "Frais",
      beforeTax: "Reste avant impôt sur le revenu",
      optionScale: "Option 1 : impôt au barème",
      taxable: (rate, minimum) => `Revenu imposable après abattement de ${rate} (au moins ${minimum})`,
      incomeTax: (year) => `Impôt au barème des revenus ${year}, personne seule (1 part), sans autre revenu, avant décote`,
      afterIncomeTax: "Reste après impôt au barème",
      optionFlat: (limit) => `Option 2 : versement libératoire, si le revenu fiscal de référence de N-2 est inférieur à ${limit} pour une personne seule`,
      flatTax: (rate) => `Versement libératoire (${rate} du chiffre d'affaires)`,
      afterFlatTax: "Reste après versement libératoire",
      ceiling: (ceiling) => `Ce chiffre d'affaires dépasse le plafond de ${ceiling} HT du régime micro : le calcul ci-dessous ne vaut que si le régime s'applique encore.`,
    },
    sasu: {
      turnover: "Chiffre d'affaires (TJM × jours)",
      expenses: "Frais",
      profit: "Bénéfice avant impôt",
      corporateTax: (reduced, ceiling, normal) => `Impôt sur les sociétés (${reduced} jusqu'à ${ceiling}, ${normal} au-delà)`,
      dividends: "Dividendes distribués",
      levies: (rate) => `Prélèvements sociaux (${rate} des dividendes)`,
      dividendTax: (rate) => `Impôt sur le revenu, prélèvement forfaitaire (${rate} des dividendes)`,
      net: "Reste après impôts",
    },
    assumptionsTitle: "Hypothèses",
    common: [
      "Montants hors TVA. Tout le chiffre d'affaires est facturé et encaissé dans l'année.",
      "Ne sont pas comptés, sauf si vous les ajoutez à vos frais : CFE, comptabilité, assurances, mutuelle, prévoyance.",
    ],
    microAssumptions: (ceiling, year) => [
      "Les cotisations et la formation professionnelle se calculent sur le chiffre d'affaires, et l'impôt sur le chiffre d'affaires après abattement forfaitaire : vos frais réels ne les réduisent pas, ils sont seulement retirés de ce qui vous reste.",
      `Plafond du régime micro pour des prestations de services et une activité libérale : ${ceiling} de chiffre d'affaires HT.`,
      `Impôt au barème des revenus ${year}, le plus récent publié, pour une personne seule (1 part) sans autre revenu : ni décote, ni réductions, ni crédits d'impôt.`,
    ],
    sasuAssumptions: (turnoverMax, ownership) => [
      "Le président ne se verse aucune rémunération : les cotisations des assimilés salariés, calculées sur une rémunération, ne sont pas simulées, ni les droits qu'elles ouvrent.",
      "Tout le bénéfice après impôt sur les sociétés est distribué en dividendes, hors réserve légale.",
      `Les conditions du taux réduit d'impôt sur les sociétés sont supposées remplies : chiffre d'affaires d'au plus ${turnoverMax}, capital entièrement libéré et détenu à ${ownership} au moins par des personnes physiques.`,
      "Les dividendes sont imposés au prélèvement forfaitaire unique, sans option pour le barème.",
    ],
    notSimulatedTitle: "Statut non simulé",
    eurl:
      "EURL à l'IS : non simulée. Le gérant associé relève du régime des travailleurs indépendants, et ses cotisations sont calculées sur ses revenus professionnels ; leurs taux n'ont pas pu être lus sur une page officielle accessible. Plutôt qu'un chiffre inventé, ce statut est laissé de côté.",
    ratesTitle: (asOf) => `Taux en vigueur au ${asOf}, sources :`,
    rateHeaders: ["Taux ou seuil", "Valeur", "Source"],
    verified: (date) => `vérifiée le ${date}`,
    faqTitle: "Questions fréquentes",
    disclaimer: "Pour une décision, faites vérifier votre situation par un expert-comptable ou par l'administration.",
  },
  en: {
    title: "Freelance net income simulator",
    description: "Estimate your net income as a freelancer in France from your day rate, billed days, legal status and expenses, with the official rates and their sources.",
    lead: "Estimate what you keep from your day rate, your billed days, your legal status and your expenses. Every rate comes from an official French page, cited below. It is an estimate: neither advice nor a promise of any result.",
    formTitle: "Your figures",
    fields: { tjm: "Day rate (€ excl. VAT)", jours: "Billed days per year", statut: "Legal status", frais: "Yearly expenses (€)" },
    hints: { tjm: "A whole number, from 1 to 10,000.", jours: "A whole number, from 1 to 365.", statut: "Pick one of the simulated statuses.", frais: "A whole number, 0 if you have none." },
    submit: "Calculate",
    invalid: "Some fields cannot be read: nothing is calculated until they can.",
    statuses: {
      "micro-bnc": "Micro-enterprise, non-regulated liberal profession (BNC, outside Cipav)",
      "micro-bic": "Micro-enterprise, commercial services (BIC)",
      "sasu-dividendes": "SASU under corporate tax, no salary, profit paid out as dividends",
    },
    resultTitle: "Result",
    example: (rate, days, status, expenses) => `Example: ${rate} per day, ${days} days, ${status}, ${expenses} of expenses.`,
    yours: (rate, days, status, expenses) => `Your simulation: ${rate} per day, ${days} days, ${status}, ${expenses} of expenses.`,
    micro: {
      turnover: "Turnover (day rate × days)",
      social: (rate) => `Social contributions (${rate} of turnover)`,
      training: (rate) => `Vocational training contribution (${rate} of turnover)`,
      expenses: "Expenses",
      beforeTax: "Left before income tax",
      optionScale: "Option 1: income tax brackets",
      taxable: (rate, minimum) => `Taxable income after a flat ${rate} allowance (at least ${minimum})`,
      incomeTax: (year) => `Income tax on the ${year} brackets, single person (1 share), no other income, before the décote`,
      afterIncomeTax: "Left after income tax",
      optionFlat: (limit) => `Option 2: flat income tax payment (versement libératoire), if the household's reference income two years earlier is below ${limit} for a single person`,
      flatTax: (rate) => `Flat income tax payment (${rate} of turnover)`,
      afterFlatTax: "Left after the flat payment",
      ceiling: (ceiling) => `This turnover is above the ${ceiling} (excl. VAT) ceiling of the micro regime: the calculation below only holds if the regime still applies.`,
    },
    sasu: {
      turnover: "Turnover (day rate × days)",
      expenses: "Expenses",
      profit: "Profit before tax",
      corporateTax: (reduced, ceiling, normal) => `Corporate tax (${reduced} up to ${ceiling}, ${normal} above)`,
      dividends: "Dividends paid",
      levies: (rate) => `Social levies (${rate} of dividends)`,
      dividendTax: (rate) => `Income tax, flat withholding (${rate} of dividends)`,
      net: "Left after taxes",
    },
    assumptionsTitle: "Assumptions",
    common: [
      "Amounts exclude VAT. All turnover is invoiced and collected within the year.",
      "Not counted unless you add them to your expenses: CFE business tax, accounting, insurance, health and provident cover.",
    ],
    microAssumptions: (ceiling, year) => [
      "Contributions and the training levy are computed on turnover, and income tax on turnover after the flat allowance: your actual expenses do not reduce them, they are only taken from what you keep.",
      `Ceiling of the micro regime for services and liberal activities: ${ceiling} of turnover excluding VAT.`,
      `Income tax on the ${year} brackets, the latest published, for a single person (1 share) with no other income: no décote, reductions or tax credits.`,
    ],
    sasuAssumptions: (turnoverMax, ownership) => [
      "The president takes no salary: the contributions of the employee-like regime, computed on a salary, are not simulated, nor the rights they open.",
      "All profit after corporate tax is paid out as dividends, leaving aside the legal reserve.",
      `The conditions of the reduced corporate tax rate are assumed to be met: turnover of at most ${turnoverMax}, share capital fully paid up and at least ${ownership} held by individuals.`,
      "Dividends are taxed at the single flat rate, without opting for the income tax brackets.",
    ],
    notSimulatedTitle: "Status not simulated",
    eurl:
      "EURL under corporate tax: not simulated. The managing partner is covered by the self-employed scheme, and their contributions are computed on their professional income; those rates could not be read on an accessible official page. Rather than an invented figure, this status is left out.",
    ratesTitle: (asOf) => `Rates in force on ${asOf}, sources:`,
    rateHeaders: ["Rate or threshold", "Value", "Source"],
    verified: (date) => `checked on ${date}`,
    faqTitle: "Frequently asked questions",
    disclaimer: "Before deciding, have your situation checked by a chartered accountant or by the administration.",
  },
};
