/*
 * What the scene of the journey shows at each of the nine steps (STORYBOARD_V2 §4 S5 and §6). Pure data, held by
 * test/mission-scene.test.ts: the green may appear at the ninth step only, never at the post, the application or the
 * signature, and the amber of the held funds only while they are held. Scrolling back replays the states in reverse,
 * because each state is a function of the step alone.
 */

export const STEPS = 9;
export const FINAL_STEP = STEPS;

export type Escrow = "none" | "held" | "released";
/** The two ways to green: the payment on Proofseen, or the client's confirmation of a mission done elsewhere. */
export type Way = "payment" | "client";

export interface SceneState {
  /** The company has posted: its node is lit. */
  readonly company: boolean;
  /** The freelancer has applied: its node is lit. */
  readonly freelance: boolean;
  /** A pulse runs from the freelancer to the card (the application leaves). */
  readonly applying: boolean;
  /** The application chip on the card: none, read, then kept. */
  readonly application: "none" | "read" | "kept";
  /** Messages run along the beam between the two nodes. */
  readonly talking: boolean;
  /** The quote has left the card and is accepted. */
  readonly quote: boolean;
  /** Both parties have signed. */
  readonly signed: boolean;
  readonly escrow: Escrow;
  /** The funds flow from the company to the freelancer. */
  readonly payout: boolean;
  /** The mission is verified: the only state that turns anything green. */
  readonly verified: boolean;
}

const clampStep = (step: number): number => Math.min(STEPS, Math.max(1, Math.round(Number.isFinite(step) ? step : 1)));

export const sceneAt = (rawStep: number): SceneState => {
  const step = clampStep(rawStep);
  return {
    company: step >= 1,
    freelance: step >= 2,
    applying: step === 2,
    application: step >= 3 ? "kept" : "none",
    talking: step === 4,
    quote: step >= 5,
    signed: step >= 6,
    escrow: step < 7 ? "none" : step === 7 ? "held" : "released",
    payout: step === 8,
    verified: step === FINAL_STEP,
  };
};

/*
 * The other way (§4 S5, after step 9): the card starts declared and not verified, a signed link goes to the company,
 * the confirmation comes back, the seal says "verified by the client". Four phases, 0 to 3; only the last is green.
 */
export const OTHER_WAY_PHASES = 4;
export const otherWayVerified = (phase: number): boolean => phase >= OTHER_WAY_PHASES - 1;
/** Milliseconds at which each phase starts; under reduced motion the last phase is shown at once. */
export const OTHER_WAY_AT: readonly number[] = [0, 520, 1300, 1900];

/**
 * The step whose box crosses the middle line of the viewport, from the boxes of the nine steps (top and bottom, in
 * viewport pixels). Above the first step it is the first; below the last, the last: the scene never shows a state
 * that does not belong to a step the reader can see.
 */
export const stepAtMiddle = (boxes: readonly { readonly top: number; readonly bottom: number }[], middle: number): number => {
  if (boxes.length === 0) return 1;
  const index = boxes.findIndex((box) => box.top <= middle && box.bottom > middle);
  if (index >= 0) return index + 1;
  const first = boxes[0];
  return first !== undefined && middle < first.top ? 1 : boxes.length;
};
