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

/*
 * Communauté (C22). Une publication ou un commentaire parle au nom d'un profil publié ou d'une entreprise : il sort du
 * public quand il est supprimé ou masqué, quand son auteur est suspendu, quand le profil n'est plus publié (privé,
 * masqué, compte suspendu) ou quand l'entreprise est masquée ou n'a plus de membre actif. Ces fragments s'emploient
 * dans un `AND: [...]` : leurs clés `OR` et `NOT` n'écrasent ainsi rien de l'appelant.
 */

/** Une publication vivante que personne n'a retirée du public (sa visibilité, publique ou membres, se filtre à part). */
export const LISTED_POST = {
  deletedAt: null,
  moderatedAt: null,
  NOT: [{ author: { is: { suspendedAt: { not: null } } } }],
  OR: [
    { profile: { is: { visibility: { not: "private" }, moderatedAt: null, user: { suspendedAt: null } } } },
    { organisation: { is: { suspendedAt: null, members: { some: { user: { suspendedAt: null } } } } } },
  ],
} satisfies Prisma.PostWhereInput;

/** Un commentaire vivant que personne n'a retiré du public. */
export const LISTED_COMMENT = {
  deletedAt: null,
  moderatedAt: null,
  NOT: [{ author: { is: { suspendedAt: { not: null } } } }],
  OR: [
    { profile: { is: { visibility: { not: "private" }, moderatedAt: null, user: { suspendedAt: null } } } },
    { organisation: { is: { suspendedAt: null, members: { some: { user: { suspendedAt: null } } } } } },
  ],
} satisfies Prisma.PostCommentWhereInput;
