import type { Prisma } from "./generated/client";

/*
 * Ce qu'un opérateur a retiré du public (C19), exclu au même endroit pour tous les chemins publics : pages de profil,
 * annuaire, recherche, missions, villes, métiers, entreprises, sitemaps, llms.txt, baromètres.
 *
 * Trois raisons de masquer :
 *  - le contenu lui-même a été masqué par un opérateur (`moderatedAt`) ;
 *  - son auteur est suspendu : son profil, les missions qu'il a écrites ;
 *  - une page d'entreprise dont plus aucun membre n'est actif (tous suspendus).
 *
 * Ces fragments s'ajoutent aux conditions existantes (publié, ouvert…), ils ne les remplacent pas. Chaque chemin public
 * a son test : un fragment oublié dans une requête se voit, il ne se devine pas.
 */

/** Un profil publié que personne n'a retiré du public. */
export const LISTED_PROFILE = {
  moderatedAt: null,
  user: { suspendedAt: null },
} as const satisfies Prisma.FreelanceProfileWhereInput;

/** Une mission que personne n'a retirée du public. Une mission sans auteur (compte effacé) reste celle de l'entreprise. */
export const LISTED_MISSION = {
  moderatedAt: null,
  NOT: { author: { is: { suspendedAt: { not: null } } } },
} as const satisfies Prisma.JobPostWhereInput;

/** Une page d'entreprise que personne n'a retirée du public, tenue par au moins un membre actif. */
export const LISTED_COMPANY = {
  moderatedAt: null,
  members: { some: { user: { suspendedAt: null } } },
} as const satisfies Prisma.OrganisationWhereInput;
