import type { FreelanceDashboard } from "@proofseen/db";

/*
 * Where a freelancer stands, so the home page leads with what matters now: arriving (profile not yet published),
 * applying (published, no contract under way), on a mission (a contract active or awaiting signatures). Derived from
 * counted facts only; it is a stage of the person's own journey, never a level compared with anyone else.
 */

export type FreelanceStage = "arrival" | "applying" | "mission";

const n = (value: number | undefined): number => value ?? 0;

export const freelanceStage = (board: FreelanceDashboard): FreelanceStage => {
  if (board.profile === null || !board.profile.published) return "arrival";
  return n(board.contracts.active) + n(board.contracts.pending_signatures) > 0 ? "mission" : "applying";
};

export type ArrivalStepKey = "create" | "complete" | "publish" | "prove";

export interface ArrivalStep {
  readonly key: ArrivalStepKey;
  readonly done: boolean;
  /** Path under `/[lang]/app`. */
  readonly path: string;
}

/** The steps to a published, proven profile, in order, each done or to do. */
export const arrivalSteps = (board: FreelanceDashboard): readonly ArrivalStep[] => {
  const profile = board.profile;
  return [
    { key: "create", done: profile !== null, path: "profil" },
    { key: "complete", done: profile !== null && profile.missing.length === 0, path: "profil" },
    { key: "publish", done: profile !== null && profile.published, path: "profil" },
    { key: "prove", done: profile !== null && profile.verifiedUrls > 0, path: "preuves" },
  ];
};

/** Applications still waiting on the company: sent, or shortlisted. */
export const applicationsInProgress = (board: FreelanceDashboard): number => n(board.applications.submitted) + n(board.applications.shortlisted);
