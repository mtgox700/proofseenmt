/*
 * The hero image is the measure itself: the 780 real J0 answers, one point each, coloured by the source family the
 * answer cites. Only platform families are named; any other domain is "other", and no person is ever represented.
 */

export const SOURCE_CATEGORIES = ["you", "malt", "linkedin", "code", "platform", "other", "none"] as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

export interface CitedDomains {
  readonly platform: Readonly<Record<string, number>>;
  readonly client: number;
  readonly other: number;
}

const FAMILIES: Readonly<Record<string, SourceCategory>> = {
  "malt.fr": "malt",
  "malt.com": "malt",
  "linkedin.com": "linkedin",
  "github.com": "code",
  "gitlab.com": "code",
};

/** The dominant source family of one answer. Ties go to the family listed first, deterministically. */
export const categorise = (cited: CitedDomains): SourceCategory => {
  if (cited.client > 0) return "you";
  const entries = Object.entries(cited.platform);
  if (entries.length === 0) return cited.other > 0 ? "other" : "none";
  const score = new Map<SourceCategory, number>();
  for (const [domain, n] of entries) {
    const family = FAMILIES[domain] ?? "platform";
    score.set(family, (score.get(family) ?? 0) + n);
  }
  return SOURCE_CATEGORIES.filter((c) => score.has(c)).reduce((best, c) => ((score.get(c) ?? 0) > (score.get(best) ?? 0) ? c : best));
};

export interface PlacedAnswer {
  readonly index: number;
  /** Engine column. */
  readonly column: number;
  readonly row: number;
  readonly col: number;
}

/** Lays the answers out in one block per engine, sorted by category so each source reads as a solid band. */
export const layoutAnswers = (
  answers: readonly { readonly engine: number; readonly category: SourceCategory }[],
  engines: number,
  perRow: number,
): PlacedAnswer[] => {
  const placed: PlacedAnswer[] = [];
  for (let column = 0; column < engines; column += 1) {
    const own = answers
      .map((answer, index) => ({ answer, index }))
      .filter(({ answer }) => answer.engine === column)
      .sort((a, b) => SOURCE_CATEGORIES.indexOf(a.answer.category) - SOURCE_CATEGORIES.indexOf(b.answer.category) || a.index - b.index);
    own.forEach(({ index }, i) => placed.push({ index, column, row: Math.floor(i / perRow), col: i % perRow }));
  }
  return placed;
};
