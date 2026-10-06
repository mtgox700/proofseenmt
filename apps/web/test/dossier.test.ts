import { describe, expect, it } from "vitest";
import type { NextAction } from "@proofseen/workspace";
import { DOSSIER_STEPS, stepsFor } from "../src/lib/dossier";

const states = (kind: NextAction["kind"]) => stepsFor({ kind } as NextAction).map((step) => step.state);

describe("stepsFor", () => {
  it("puts a brand-new file on its first step, waiting on the client", () => {
    const steps = stepsFor({ kind: "fill_identity" });
    expect(steps[0]).toMatchObject({ key: "identity", state: "active", actor: "client" });
    expect(steps.slice(1).every((step) => step.state === "todo")).toBe(true);
  });

  it("marks every earlier step done and the measure as Proofseen's job", () => {
    const steps = stepsFor({ kind: "measure" });
    const active = steps.find((step) => step.state === "active");
    expect(active).toMatchObject({ key: "measure", actor: "proofseen" });
    expect(steps.slice(0, steps.indexOf(active!)).every((step) => step.state === "done")).toBe(true);
  });

  it("groups the three manifest actions under one preparation step", () => {
    for (const kind of ["build_wave", "repair_manifest", "freeze_manifest"] as const) {
      expect(stepsFor({ kind }).find((step) => step.state === "active")?.key).toBe("prepare");
    }
  });

  it("closes every step once the report is delivered", () => {
    expect(states("done").every((state) => state === "done")).toBe(true);
  });

  it("never pretends a step is done when the file cannot be read", () => {
    expect(states("unreadable").every((state) => state === "blocked")).toBe(true);
  });

  it("keeps a fixed, ordered list of steps", () => {
    expect(DOSSIER_STEPS).toEqual(["identity", "possession", "surface", "prepare", "measure", "report"]);
    expect(stepsFor({ kind: "check_surface", reason: "missing" })).toHaveLength(DOSSIER_STEPS.length);
  });
});
