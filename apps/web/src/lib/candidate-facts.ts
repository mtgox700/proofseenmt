import type { FactLine } from "@/components/market/FactLines";
import type { MissionsSpaceDictionary } from "@/i18n/market/missions-space-fr";

/** The verified facts an application carries, read from the database: counts of a third party's checks, never a score. */
export interface CandidateFacts {
  readonly verifiedMissions: number;
  readonly verifiedUrls: number;
}

/**
 * A candidate's facts as lines of the register, in the order of the one profile card (missions, then addresses): a
 * green square for each verified fact present, and one ruled line when there is none yet. Each fact stands for
 * itself; none is added to another to rank a person (AI Act).
 */
export const candidateFactLines = (facts: CandidateFacts, b: MissionsSpaceDictionary["board"]): readonly FactLine[] => {
  const lines: readonly FactLine[] = [
    ...(facts.verifiedMissions > 0 ? [{ text: b.verifiedMissions(facts.verifiedMissions), verified: true }] : []),
    ...(facts.verifiedUrls > 0 ? [{ text: b.provenUrls(facts.verifiedUrls), verified: true }] : []),
  ];
  return lines.length === 0 ? [{ text: b.noProof, verified: false }] : lines;
};
