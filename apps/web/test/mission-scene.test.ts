import { describe, expect, it } from "vitest";
import { FINAL_STEP, OTHER_WAY_PHASES, otherWayVerified, sceneAt, STEPS, stepAtMiddle } from "../src/components/landing/mission-scene";

/*
 * The scene of the journey on the home page (STORYBOARD_V2 §4 S5 and §6). The visitor who scrolls back and forth
 * checks for themselves that the green comes at the right moment: these tests hold the same promise in code.
 */

const steps = Array.from({ length: STEPS }, (_, i) => i + 1);

describe("the green of the journey", () => {
  it("appears at the ninth step only: never at the post, the application, the signature or the payment", () => {
    expect(steps.filter((step) => sceneAt(step).verified)).toEqual([FINAL_STEP]);
    expect(FINAL_STEP).toBe(9);
  });

  it("holds the funds in amber at the payment only, and releases them after", () => {
    expect(steps.map((step) => sceneAt(step).escrow)).toEqual(["none", "none", "none", "none", "none", "none", "held", "released", "released"]);
  });

  it("is a function of the step alone: going back replays the states in reverse", () => {
    const down = steps.map((step) => sceneAt(step));
    const up = [...steps].reverse().map((step) => sceneAt(step));
    expect([...up].reverse()).toEqual(down);
  });

  it("never shows a step outside the nine, whatever it is given", () => {
    expect(sceneAt(0)).toEqual(sceneAt(1));
    expect(sceneAt(42)).toEqual(sceneAt(9));
    expect(sceneAt(Number.NaN)).toEqual(sceneAt(1));
  });

  it("verifies the other way only at its last phase, when the client has confirmed", () => {
    expect(Array.from({ length: OTHER_WAY_PHASES }, (_, phase) => otherWayVerified(phase))).toEqual([false, false, false, true]);
  });
});

describe("the step in the middle of the screen", () => {
  const boxes = steps.map((step) => ({ top: step * 100, bottom: step * 100 + 100 }));

  it("is the step whose box crosses the middle line", () => {
    expect(stepAtMiddle(boxes, 350)).toBe(3);
    expect(stepAtMiddle(boxes, 999)).toBe(9);
  });

  it("is the first above the list and the last below it", () => {
    expect(stepAtMiddle(boxes, 10)).toBe(1);
    expect(stepAtMiddle(boxes, 5000)).toBe(9);
    expect(stepAtMiddle([], 10)).toBe(1);
  });
});
