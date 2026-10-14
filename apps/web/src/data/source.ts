import type { AnswersSnapshot } from "./schema";

/*
 * The door through which the landing reads its one snapshot file: the real answers of the founder's J0 wave, written
 * by `pnpm --filter @proofseen/web snapshot` from the CLI artefacts. Everything else the public site shows comes from
 * the database.
 */
export interface WorkspaceSource {
  /** One entry per real answer of the founder's J0 wave: the hero image of the landing. */
  answers(): Promise<AnswersSnapshot>;
}
