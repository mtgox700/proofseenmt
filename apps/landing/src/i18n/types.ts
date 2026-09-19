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
  readonly offers: { readonly kicker: string; readonly title: string; readonly list: readonly Offer[]; readonly closed: string; readonly legal: string };
  readonly companies: { readonly kicker: string; readonly title: string; readonly text: string; readonly points: readonly string[]; readonly cta: string };
  readonly charter: { readonly kicker: string; readonly title: string; readonly items: readonly Step[] };
  readonly faq: { readonly title: string; readonly items: readonly Faq[] };
  readonly footer: { readonly line: string; readonly legal: string };
}
