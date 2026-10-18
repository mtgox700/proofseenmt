import type { AvailabilityStatus } from "./generated/enums";

/*
 * Fraîcheur de la disponibilité (C23) : la seule source de la règle des 30 jours, pour tout ce qui la lit (recherche,
 * facettes, rapprochement, page publique, cartes, annuaire public) et pour le rappel des 14 jours.
 *
 * Décision (2026-10-19) : le seuil reste à 30 jours. La recherche (`availabilityFreshSince`) et le rapprochement
 * (`MATCH_FRESH_DAYS`) appliquaient déjà 30 jours, chacun avec sa propre constante ; elles lisent désormais celle-ci.
 * Le rappel part à 14 jours pour laisser au freelance deux semaines avant la bascule.
 *
 * Passé le seuil, une disponibilité déclarée (« disponible », « disponible à partir du ») s'affiche « non confirmée » :
 * on ne dit plus aux entreprises ni aux moteurs une chose que la personne n'a pas redite. Le profil n'est jamais masqué.
 * « Indisponible » reste affiché tel quel : ce n'est pas une promesse qui attire un contact, et le freelance qui l'a
 * déclaré ne reçoit pas de rappel.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Une disponibilité déclarée ou confirmée il y a plus de 30 jours n'est plus tenue pour vraie. */
export const AVAILABILITY_FRESH_DAYS = 30;
/** Un rappel de confirmation au plus par fenêtre de 14 jours, tant que la disponibilité n'est pas reconfirmée. */
export const AVAILABILITY_REMINDER_DAYS = 14;

export const availabilityFreshSince = (now: Date): Date => new Date(now.getTime() - AVAILABILITY_FRESH_DAYS * DAY_MS);

/** Le moment avant lequel une confirmation, ou un rappel, est assez ancien pour qu'un nouveau rappel parte. */
export const availabilityReminderBefore = (now: Date): Date => new Date(now.getTime() - AVAILABILITY_REMINDER_DAYS * DAY_MS);

/** Confirmée depuis 30 jours au plus, bornes comprises (la même comparaison que le filtre `gte` de la recherche). */
export const isAvailabilityFresh = (confirmedAt: Date, now: Date): boolean => confirmedAt.getTime() >= availabilityFreshSince(now).getTime();

/** Ce qu'un écran affiche : le statut déclaré, ou « non confirmée » pour une disponibilité trop ancienne. */
export type ShownAvailability = AvailabilityStatus | "unconfirmed";

export const shownAvailability = (status: AvailabilityStatus, confirmedAt: Date, now: Date): ShownAvailability =>
  status !== "unavailable" && !isAvailabilityFresh(confirmedAt, now) ? "unconfirmed" : status;

/** Une disponibilité à reconfirmer : déclarée (pas « indisponible ») et confirmée il y a 14 jours ou plus. */
export const availabilityReminderDue = (status: AvailabilityStatus, confirmedAt: Date, now: Date): boolean =>
  status !== "unavailable" && confirmedAt.getTime() <= availabilityReminderBefore(now).getTime();
