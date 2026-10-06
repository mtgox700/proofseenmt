export type Locale = "fr" | "en";

export interface Step {
  readonly title: string;
  readonly text: string;
}

export interface Offer {
  readonly name: string;
  readonly price: string;
  readonly unit: string;
  readonly items: readonly string[];
}

export interface Faq {
  readonly q: string;
  readonly a: string;
}

/** Every visible string of the landing. FR and EN must have the same shape (checked by tests). */
export interface Dictionary {
  readonly meta: { readonly title: string; readonly description: string };
  readonly nav: { readonly method: string; readonly offers: string; readonly companies: string; readonly charter: string; readonly otherLang: string; readonly skip: string };
  readonly hero: {
    readonly eyebrow: string;
    readonly title: string;
    readonly lead: string;
    readonly cta: string;
    readonly secondary: string;
    readonly note: string;
    /** Live simulator (fictitious data). {hits} {n} {p} {lo} {hi} are replaced at render time. */
    readonly sim: {
      readonly label: string;
      readonly tag: string;
      readonly engine: string;
      readonly recruiter: string;
      readonly prompt: string;
      readonly answer: string;
      readonly you: string;
      readonly outside: string;
      readonly run: string;
      readonly tally: string;
      readonly estimate: string;
      readonly summary: string;
    };
  };
  readonly problem: { readonly kicker: string; readonly title: string; readonly steps: readonly Step[] };
  readonly method: {
    readonly kicker: string;
    readonly title: string;
    readonly steps: readonly Step[];
    readonly preview: {
      readonly caption: string;
      readonly legend: string;
      readonly stages: readonly string[];
      readonly engines: readonly string[];
      readonly score: string;
    };
  };
  readonly proof: { readonly kicker: string; readonly title: string; readonly facts: readonly { readonly value: string; readonly label: string }[] };
  /** Étude de cas J0 : nos propres mesures, datées et sourcées. Aucun chiffre client, aucun témoignage. */
  readonly study: {
    readonly kicker: string;
    readonly title: string;
    readonly lead: string;
    readonly facts: readonly { readonly value: string; readonly label: string }[];
    readonly sources: string;
    readonly limits: string;
  };
  /**
   * Ce que le client reçoit. L'extrait est repris **mot pour mot** du rapport généré sur notre propre mesure : aucun
   * exemple inventé, aucun rapport client — nous n'en avons pas encore.
   */
  readonly deliverable: {
    readonly kicker: string;
    readonly title: string;
    readonly lead: string;
    readonly contents: readonly string[];
    readonly sample: {
      readonly caption: string;
      readonly blocking: string;
      readonly action: { readonly rank: string; readonly title: string; readonly why: string; readonly effort: string; readonly evidence: string };
      readonly labels: { readonly why: string; readonly effort: string; readonly evidence: string };
    };
    readonly note: string;
  };
  readonly offers: { readonly kicker: string; readonly title: string; readonly list: readonly Offer[]; readonly closed: string; readonly legal: string };
  readonly companies: { readonly kicker: string; readonly title: string; readonly text: string; readonly points: readonly string[]; readonly cta: string };
  readonly charter: { readonly kicker: string; readonly title: string; readonly items: readonly Step[] };
  /**
   * Tunnel de commande (US-P01). Les mentions obligatoires sont affichées **sur la page, avant le paiement** — pas
   * derrière un lien : en vente à distance, ce qui n'a pas été montré avant l'engagement n'a pas été porté à
   * connaissance. Les dates viennent de `PRESALE_DATES`, jamais recopiées ici.
   */
  readonly order: {
    readonly meta: { readonly title: string; readonly description: string };
    readonly kicker: string;
    readonly title: string;
    readonly lead: string;
    readonly back: string;
    readonly items: readonly {
      readonly name: string;
      readonly price: string;
      readonly scope: string;
      readonly includes: readonly string[];
      readonly excludes: readonly string[];
      readonly cta: string;
    }[];
    readonly terms: {
      readonly title: string;
      /** `{date}` est remplacé par la date de livraison maximale. */
      readonly delivery: string;
      /** `{days}` est remplacé par la durée légale de rétractation. */
      readonly withdrawal: string;
      readonly refundTitle: string;
      /** `{gate}` et `{delivery}` sont remplacés par les dates contractuelles. */
      readonly refunds: readonly { readonly when: string; readonly then: string }[];
      readonly neverTitle: string;
      readonly never: string;
      readonly noPromiseTitle: string;
      readonly noPromise: readonly string[];
      readonly accept: string;
    };
    readonly closed: string;
    readonly closedWhy: string;
  };
  readonly faq: { readonly title: string; readonly items: readonly Faq[] };
  readonly footer: { readonly line: string; readonly legal: string };
}
