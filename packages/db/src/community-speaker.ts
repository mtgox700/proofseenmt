import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { ProfileVisibility } from "./generated/enums";
import type { Actor } from "./messaging";
import { publicName } from "./public-profiles";
import { LISTED_PROFILE } from "./public-visibility";

/*
 * Au nom de qui l'on parle dans la communauté (C22) : son profil freelance publié, ou une entreprise dont on est membre.
 * Jamais le nom du compte de connexion : un profil pseudonyme parle sous sa référence (FR-XXXXX), une entreprise sous
 * son nom public. Le droit de parler est vérifié dans la requête, à chaque écriture.
 */

export type SpeakerChoice = { readonly as: "profile" } | { readonly as: "organisation"; readonly organisationId: string };

export interface Speaker {
  readonly profileId: string | null;
  readonly organisationId: string | null;
  /** Un profil nominatif ou une entreprise : seuls ceux-là publient une image (un profil pseudonyme ne montre rien qui l'identifie). */
  readonly mayShowImage: boolean;
}

const Uuid = z.uuid();

/** Le locuteur de l'acteur pour ce choix, ou `null` s'il n'a pas le droit de parler ainsi. */
export const resolveSpeaker = async (db: Db | Prisma.TransactionClient, actor: Actor, choice: SpeakerChoice): Promise<Speaker | null> => {
  if (choice.as === "profile") {
    const profile = await db.freelanceProfile.findFirst({
      where: { userId: actor.userId, visibility: { not: "private" }, ...LISTED_PROFILE },
      select: { id: true, visibility: true },
    });
    return profile === null ? null : { profileId: profile.id, organisationId: null, mayShowImage: profile.visibility === "named" };
  }
  if (!Uuid.safeParse(choice.organisationId).success) return null;
  const member = await db.membership.findFirst({
    where: { userId: actor.userId, organisationId: choice.organisationId, user: { suspendedAt: null }, organisation: { suspendedAt: null } },
    select: { organisationId: true },
  });
  return member === null ? null : { profileId: null, organisationId: member.organisationId, mayShowImage: true };
};

/** Ce que l'on lit du locuteur d'une publication ou d'un commentaire pour l'afficher. */
export const SPEAKER_SELECT = {
  profile: { select: { id: true, userId: true, reference: true, slug: true, visibility: true, moderatedAt: true, user: { select: { displayName: true, suspendedAt: true } } } },
  organisation: { select: { id: true, name: true, publicName: true, publicSlug: true, publicSince: true, moderatedAt: true } },
} as const;

interface SpeakerRow {
  readonly profile: {
    readonly id: string;
    readonly reference: string;
    readonly slug: string | null;
    readonly visibility: ProfileVisibility;
    readonly moderatedAt: Date | null;
    readonly user: { readonly displayName: string; readonly suspendedAt: Date | null };
  } | null;
  readonly organisation: {
    readonly id: string;
    readonly name: string;
    readonly publicName: string | null;
    readonly publicSlug: string | null;
    readonly publicSince: Date | null;
    readonly moderatedAt: Date | null;
  } | null;
}

/** Le locuteur tel qu'un écran ou une page publique le montre. */
export interface AuthorView {
  readonly kind: "profile" | "organisation";
  readonly profileId: string | null;
  readonly organisationId: string | null;
  /** Le nom d'un profil nominatif, la référence d'un profil pseudonyme, le nom public d'une entreprise. */
  readonly name: string;
  /** Référence publique du profil (FR-XXXXX) ; `null` pour une entreprise. */
  readonly reference: string | null;
  /** Adresse de la page publique du profil, s'il est publié et non retiré. */
  readonly profileSlug: string | null;
  /** Adresse de la page publique de l'entreprise, si elle en a une et qu'elle n'est pas masquée. */
  readonly companySlug: string | null;
  /** Une image publiée peut être montrée sous ce nom (profil nominatif ou entreprise). */
  readonly mayShowImage: boolean;
}

/** Le locuteur à afficher ; `null` quand il n'y en a plus (compte effacé). */
export const authorView = (row: SpeakerRow): AuthorView | null => {
  if (row.profile !== null) {
    const p = row.profile;
    const listed = p.visibility !== "private" && p.moderatedAt === null && p.user.suspendedAt === null;
    const name = p.visibility === "private" ? null : publicName(p.visibility, p.user.displayName);
    return {
      kind: "profile",
      profileId: p.id,
      organisationId: null,
      name: name ?? p.reference,
      reference: p.reference,
      profileSlug: listed ? p.slug : null,
      companySlug: null,
      mayShowImage: name !== null,
    };
  }
  if (row.organisation !== null) {
    const o = row.organisation;
    const publicPage = o.publicSince !== null && o.moderatedAt === null && o.publicSlug !== null;
    return {
      kind: "organisation",
      profileId: null,
      organisationId: o.id,
      name: o.publicName ?? o.name,
      reference: null,
      profileSlug: null,
      companySlug: publicPage ? o.publicSlug : null,
      mayShowImage: true,
    };
  }
  return null;
};
