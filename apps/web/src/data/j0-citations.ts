/*
 * The citation mix of the founder's J0 wave (780 answers, drawn on 23 and 24 September 2026), counted from the sealed
 * draws: field `citedDomains` of runs/J0/draws.jsonl, summed by the wave report (report/J0.md, "Mix des sources
 * citées"). Both files stay on the measuring machine (runs/ and report/ are not committed); the shares were first
 * published in .war-room/research/E_COMPORTEMENT_MOTEURS_J0.md.
 *
 * The answers snapshot the storefront reads (data/j0-answers.json) keeps, for each answer, which platform domains it
 * cites and how many other citations it holds, not how many times each platform was cited. So the counts are written
 * here, once, and test/home-page.test.ts holds them against the snapshot: the other citations add up to the same
 * number, and no domain is counted fewer times than the answers that cite it.
 */

export const J0_CITATIONS = {
  answers: 780,
  /** Every citation of every answer: the platform domains below plus the other domains, whose names are not kept. */
  total: 2328,
  other: 571,
  platforms: {
    "malt.fr": 908,
    "linkedin.com": 618,
    "free-work.com": 67,
    "github.com": 67,
    "malt.com": 58,
    "upwork.com": 14,
    "codeur.com": 12,
    "comet.co": 9,
    "gitlab.com": 2,
    "welcometothejungle.com": 1,
    "cremedelacreme.io": 1,
  },
} as const;

export type CitedPlatform = keyof typeof J0_CITATIONS.platforms;

/** The three domains the storefront draws, each with its raw count over the same total. */
export const SHOWN_SHARES: readonly CitedPlatform[] = ["malt.fr", "linkedin.com", "github.com"];
