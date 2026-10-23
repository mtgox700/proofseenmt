import { shownAvailability, type ProfileCard } from "@proofseen/db";
import { anyVerifiedCard, profileCardLegend, type ProfileCardView } from "@proofseen/hub";
import type { Lang } from "@/i18n";

/*
 * A company search result, seen as the one profile card of the marketplace (@proofseen/hub, `profileCardBody`): the
 * same fields the public directory shows, read with the same 30-day availability rule (C23). Name and photo exist for
 * a named profile only; the database already leaves them out of a pseudonymous one, and the card checks again.
 */
export const profileCardView = (card: ProfileCard, now: Date): ProfileCardView => ({
  slug: card.slug,
  reference: card.reference,
  displayName: card.displayName ?? null,
  photoFileId: card.photoFileId,
  headline: card.headline,
  city: card.city,
  workMode: card.workMode,
  dailyRateCents: card.dailyRateCents,
  currency: card.currency,
  availability: shownAvailability(card.availability, card.availabilityAt, now),
  availableFrom: card.availableFrom,
  availabilityAt: card.availabilityAt,
  skills: card.skills,
  languages: card.languages,
  hasPortfolio: card.hasPortfolio,
  facts: {
    registryActive: card.registryActive,
    identityVerified: card.identityVerified,
    vigilanceValid: card.vigilanceValid,
    verifiedMissions: card.verifiedMissions,
    provenUrls: card.verifiedUrls,
    payingClients: card.payingClients,
  },
  updatedAt: card.updatedAt,
});

/**
 * The key of the cards shown together (search results, a list, the profiles close to a mission), as on the public
 * directory: the green square only when one of these cards carries a verified fact (Kensa M5). A page without proof
 * has no green.
 */
export const profileCardKey = (cards: readonly ProfileCard[], lang: Lang, now: Date): string =>
  profileCardLegend(lang, { proof: anyVerifiedCard(cards.map((card) => profileCardView(card, now))) });
