import { shownAvailability, type AvailabilityStatus, type ShownAvailability } from "@proofseen/db";

/*
 * How a card of the connected space shows a freelancer's availability (C23): the database rule decides (30 days
 * without a confirmation reads "not confirmed", never "available"), the card only picks the tone. The profile itself
 * is never hidden for it.
 */

export type AvailabilityTone = "now" | "later" | "off";

export interface AvailabilityDisplay {
  readonly shown: ShownAvailability;
  readonly tone: AvailabilityTone;
}

export const availabilityDisplay = (status: AvailabilityStatus, confirmedAt: Date, now: Date): AvailabilityDisplay => {
  const shown = shownAvailability(status, confirmedAt, now);
  return { shown, tone: shown === "available" ? "now" : shown === "available_from" ? "later" : "off" };
};
