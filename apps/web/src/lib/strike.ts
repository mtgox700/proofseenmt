/*
 * When an acknowledgement may strike its seal (CONNECTED_PLAN section 2.4): only for a decision read in the database,
 * and only right after it was taken. An old decision opened again, from a bookmark or the history, shows its seal set,
 * still: the strike is the moment a fact becomes verified, not a decoration of the page that records it.
 */

/** How long after a decision its acknowledgement may still strike: the time to be sent back to the page. */
export const STRIKE_WINDOW_MS = 10 * 60_000;

/** True when `decidedAt` is within the window around `now` (the clocks of two servers may differ by a little). */
export const strikesNow = (decidedAt: Date, now: Date): boolean => Math.abs(now.getTime() - decidedAt.getTime()) <= STRIKE_WINDOW_MS;
