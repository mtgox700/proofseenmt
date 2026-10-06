import type { PublicProfile } from "./identity";

/*
 * The one ordering rule of the whole site, API and connector included. No score and no automated ranking: Annex III
 * point 4 of the AI Act covers access to self-employment (CONFORMITE). Freshness first, then the public identifier —
 * a rule a freelancer can verify, stated wherever a list is shown.
 */

export const byFreshnessThenId = (a: PublicProfile, b: PublicProfile): number =>
  a.availability.updatedAt === b.availability.updatedAt
    ? a.id.localeCompare(b.id)
    : b.availability.updatedAt.localeCompare(a.availability.updatedAt);

export const publishedOrder = (profiles: readonly PublicProfile[]): PublicProfile[] => [...profiles].sort(byFreshnessThenId);

export const ORDERING_NOTE = {
  fr: "Tri par date de mise à jour du profil, puis par identifiant. Aucun classement automatique, aucun score.",
  en: "Ordered by profile update date, then by identifier. No automated ranking, no score.",
} as const;
