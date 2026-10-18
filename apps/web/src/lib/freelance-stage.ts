import { availabilityReminderDue, type FreelanceDashboard, type REQUIRED_TO_PUBLISH } from "@proofseen/db";

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

/**
 * The guided publication (C23): each fact the database requires before publishing (REQUIRED_TO_PUBLISH: headline,
 * summary, city), one step each and in that order, then publishing itself, then proving an address.
 */
export const ARRIVAL_STEP_KEYS = ["create", "headline", "summary", "city", "publish", "prove"] as const;
export type ArrivalStepKey = (typeof ARRIVAL_STEP_KEYS)[number];

export interface ArrivalStep {
  readonly key: ArrivalStepKey;
  readonly done: boolean;
  /** Path under `/[lang]/app`, with the field the person fills in. */
  readonly path: string;
}

type RequiredField = (typeof REQUIRED_TO_PUBLISH)[number];

/** The ids are the ones of the profile form and of its publication panel. */
const PATHS: Readonly<Record<ArrivalStepKey, string>> = {
  create: "profil",
  headline: "profil#headline",
  summary: "profil#summary",
  city: "profil#city",
  publish: "profil#publication-title",
  prove: "preuves",
};

/** The steps to a published, proven profile, in order, each done or to do. */
export const arrivalSteps = (board: FreelanceDashboard): readonly ArrivalStep[] => {
  const profile = board.profile;
  const filled = (field: RequiredField): boolean => profile !== null && !profile.missing.includes(field);
  const done: Readonly<Record<ArrivalStepKey, boolean>> = {
    create: profile !== null,
    headline: filled("headline"),
    summary: filled("summary"),
    city: filled("city"),
    publish: profile !== null && profile.published,
    prove: profile !== null && profile.verifiedUrls > 0,
  };
  return ARRIVAL_STEP_KEYS.map((key) => ({ key, done: done[key], path: PATHS[key] }));
};

/** The first step still to do, the one the home page puts forward; `null` once every step is done. */
export const nextArrivalStep = (steps: readonly ArrivalStep[]): ArrivalStep | null => steps.find((step) => !step.done) ?? null;

/**
 * Everything the database requires is filled in and the profile is still private: the home page offers to publish in
 * one click, named or under the reference. It never publishes on its own.
 */
export const readyToPublish = (board: FreelanceDashboard): boolean => board.profile !== null && !board.profile.published && board.profile.missing.length === 0;

/** A published profile whose declared availability was last confirmed 14 days ago or more: the home asks again. */
export const availabilityCheckDue = (board: FreelanceDashboard, now: Date): boolean =>
  board.profile !== null && board.profile.published && availabilityReminderDue(board.profile.availability, board.profile.availabilityAt, now);

/** Applications still waiting on the company: sent, or shortlisted. */
export const applicationsInProgress = (board: FreelanceDashboard): number => n(board.applications.submitted) + n(board.applications.shortlisted);
