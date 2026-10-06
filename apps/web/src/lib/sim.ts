import { wilson } from "@proofseen/stats";

/*
 * The hero replays the real J0 count for one engine: zero appearances out of 200 answers. What moves is the only thing
 * that honestly changes as answers accumulate: the upper bound of the interval, computed with the same Wilson formula
 * as the client report.
 */

export const J0_DRAWS_PER_ENGINE = 200;

export const upperBoundAt = (answers: number): number => (answers === 0 ? 1 : (wilson(0, answers)?.high ?? 1));

/** Counter values for the tally, front-loaded where the interval moves the most, ending exactly on `total`. */
export const tallyFrames = (total: number, steps: number): number[] => {
  const frames: number[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const eased = Math.ceil(total * (i / steps) ** 2);
    const previous = frames.at(-1) ?? 0;
    frames.push(Math.min(total, Math.max(previous + 1, eased)));
  }
  return frames.at(-1) === total ? frames : [...frames.filter((n) => n < total), total];
};
