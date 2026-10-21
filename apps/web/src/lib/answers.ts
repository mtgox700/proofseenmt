/*
 * The hero image is the measure itself: the 780 real J0 answers, one slot each, drawn by the source family the answer
 * cites (lib/registre.ts). Only platform families are named; any other domain is "other", and no person is ever
 * represented.
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
