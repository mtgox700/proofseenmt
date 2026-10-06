import { actor, type NextAction } from "@proofseen/workspace";

/*
 * A client's file, told as an ordered path. The state comes from `@proofseen/workspace` (the same `nextAction` the
 * operator's dashboard reads): this file only decides where on the path that action sits, never what the action is.
 */

export const DOSSIER_STEPS = ["identity", "possession", "surface", "prepare", "measure", "report"] as const;
export type DossierStep = (typeof DOSSIER_STEPS)[number];
export type StepState = "done" | "active" | "todo" | "blocked";

export interface Step {
  readonly key: DossierStep;
  readonly state: StepState;
  /** Who has to act on the active step; `null` elsewhere. */
  readonly actor: "client" | "proofseen" | null;
}

const STEP_OF: Readonly<Record<Exclude<NextAction["kind"], "unreadable" | "done">, DossierStep>> = {
  fill_identity: "identity",
  prove_possession: "possession",
  check_surface: "surface",
  build_wave: "prepare",
  repair_manifest: "prepare",
  freeze_manifest: "prepare",
  measure: "measure",
  deliver_report: "report",
};

export const stepsFor = (action: NextAction): Step[] => {
  if (action.kind === "unreadable") return DOSSIER_STEPS.map((key) => ({ key, state: "blocked", actor: null }));
  if (action.kind === "done") return DOSSIER_STEPS.map((key) => ({ key, state: "done", actor: null }));
  const current = DOSSIER_STEPS.indexOf(STEP_OF[action.kind]);
  return DOSSIER_STEPS.map((key, i) => ({
    key,
    state: i < current ? "done" : i === current ? "active" : "todo",
    actor: i === current ? actor(action) : null,
  }));
};
