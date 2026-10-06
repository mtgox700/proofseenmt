import type { AnswersSnapshot, FreelanceWorkspace, ProfilesSnapshot } from "./schema";

/*
 * The single door through which the web reads data (TEAM_MEMORY 2026-09-29, Maxwell). Today: snapshot files written by
 * `pnpm --filter @proofseen/web snapshot` from the CLI artefacts. Tomorrow: Postgres, by swapping the implementation
 * returned from `getSource()` and nothing else.
 */
export interface WorkspaceSource {
  /** `null` when no workspace exists for this reference. */
  freelance(reference: string): Promise<FreelanceWorkspace | null>;
  profiles(): Promise<ProfilesSnapshot>;
  /** One entry per real answer of the founder's J0 wave: the hero image of the landing. */
  answers(): Promise<AnswersSnapshot>;
}

/** The demo workspace: the founder's own measure, published with his consent (landing, « mesuré sur nous-mêmes »). */
export const DEMO_REFERENCE = "FR-7H2XK";
