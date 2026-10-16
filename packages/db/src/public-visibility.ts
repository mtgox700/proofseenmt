import type { Prisma } from "./generated/client";

/*
 * Ce qu'un opérateur a retiré du public (C19), exclu au même endroit pour tous les chemins publics : pages de profil,
 * annuaire, recherche, missions, villes, métiers, entreprises, sitemaps, llms.txt, baromètres.
 *
 * Quatre raisons de masquer :
 *  - le contenu lui-même a été masqué par un opérateur (`moderatedAt`) ;
 *  - son auteur est suspendu : son profil, les missions qu'il a écrites ;
 *  - l'entreprise entière a été masquée par un opérateur (`Organisation.suspendedAt`, revue vague 3, M5) : sa page et
 *    toutes ses missions, quel qu'en soit l'auteur ;
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

/**
 * Une mission que personne n'a retirée du public. Une mission sans auteur (compte effacé) reste celle de l'entreprise.
 * Les exclusions passent par `NOT` : une clé `organisation` posée par l'appelant à côté de ce fragment ne l'écrase pas.
 */
export const LISTED_MISSION = {
  moderatedAt: null,
  NOT: [{ author: { is: { suspendedAt: { not: null } } } }, { organisation: { suspendedAt: { not: null } } }],
} satisfies Prisma.JobPostWhereInput;

/**
 * Le même critère que LISTED_PROFILE, sur une ligne déjà lue : un profil masqué, ou dont le compte est suspendu, se
 * montre comme non publié là où une entreprise le voit encore (listes, candidatures).
 */
export const isListedProfile = (p: { readonly moderatedAt: Date | null; readonly user: { readonly suspendedAt: Date | null } }): boolean =>
  p.moderatedAt === null && p.user.suspendedAt === null;

/** Une page d'entreprise que personne n'a retirée du public, tenue par au moins un membre actif. */
export const LISTED_COMPANY = {
  moderatedAt: null,
  suspendedAt: null,
  members: { some: { user: { suspendedAt: null } } },
} as const satisfies Prisma.OrganisationWhereInput;
