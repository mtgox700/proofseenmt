import { getDb, ownSpeakers, postStats, type PostSightingScope, type SpeakerChoice } from "@proofseen/db";
import { currentOrganisation, type Market } from "@/lib/market";
import { logError } from "@/lib/log";
import { sightingOf } from "./audience";
import { audienceWriteAllowed } from "./audience-rate";

/*
 * The community screens' view of who speaks (C22): a freelancer posts as their published profile, a company member as
 * the company they act for (the one chosen in the settings). Nobody else gets a composer.
 */

export interface ChosenSpeaker {
  readonly choice: SpeakerChoice;
  readonly kind: "profile" | "organisation";
  readonly name: string;
  readonly mayShowImage: boolean;
}

export const speakerOf = async (market: Market): Promise<ChosenSpeaker | null> => {
  const own = await ownSpeakers(market.db, market.actor);
  if (market.person.role === "freelance") {
    return own.profile === null ? null : { choice: { as: "profile" }, kind: "profile", name: own.profile.name, mayShowImage: own.profile.mayShowImage };
  }
  if (market.person.role !== "company") return null;
  const current = await currentOrganisation(market);
  const found = current === null ? undefined : own.organisations.find((o) => o.id === current.id);
  return found === undefined ? null : { choice: { as: "organisation", organisationId: found.id }, kind: "organisation", name: found.name, mayShowImage: true };
};

/**
 * Impressions (posts shown by a feed) and views (a post page opened), counted after the page is sent, like profile
 * views (C17): a one-day fingerprint, never the address; crawlers, prefetches and the author do not count.
 */
export const countPostSightings = async (headers: Headers, scope: PostSightingScope, ids: readonly string[], viewerClerkId: string | null, now: Date = new Date()): Promise<void> => {
  if (ids.length === 0) return;
  try {
    const sighting = sightingOf(headers, viewerClerkId, now);
    if (sighting === null || !(await audienceWriteAllowed(headers, now))) return;
    await postStats(getDb()).record(scope, ids, sighting);
  } catch (error) {
    logError(`audience: post ${scope}s not counted`, error);
  }
};
