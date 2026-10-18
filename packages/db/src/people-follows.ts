import { z } from "zod";
import type { Db } from "./client";
import { MAX_FOLLOWED_PROFILES } from "./community-input";
import { notifyCommunity } from "./community-notify";
import { companyFollows, type FollowedCompany } from "./company-follows";
import type { Actor } from "./messaging";
import { publicName } from "./public-profiles";
import { LISTED_PROFILE } from "./public-visibility";

/*
 * Suivre des personnes (C22) : n'importe quel compte suit un profil freelance publié, jamais le sien ; ses
 * publications arrivent alors dans le fil « Suivis ». Les entreprises suivies restent celles de C16 (`company-follows`).
 *
 * Le titulaire du profil voit qui le suit, mais seulement sous un nom déjà public : un abonné qui a lui-même un profil
 * publié apparaît sous ce profil (son nom s'il est nominatif, sa référence sinon) ; les autres sont comptés, jamais
 * nommés. Une entreprise ne voit toujours pas qui la suit (décision de C16).
 */

export type ProfileFollowResult = "followed" | "already" | "limit" | "absent" | "self";

export interface FollowedProfile {
  readonly profileId: string;
  readonly reference: string;
  /** Le nom d'un profil nominatif, la référence d'un profil pseudonyme. */
  readonly name: string;
  /** Adresse de la page publique ; `null` si le profil n'est plus publié. */
  readonly slug: string | null;
  readonly followedAt: Date;
}

export interface Follower {
  readonly reference: string;
  readonly name: string;
  readonly slug: string;
  readonly followedAt: Date;
}

export interface Followers {
  readonly total: number;
  /** Ceux qui ont un profil publié, les plus récents d'abord. */
  readonly shown: readonly Follower[];
}

export interface PeopleFollows {
  follow(actor: Actor, reference: string, now: Date): Promise<ProfileFollowResult>;
  unfollow(actor: Actor, profileId: string): Promise<boolean>;
  /** Le profil publié de cette référence, et si l'acteur le suit ou si c'est le sien ; `null` s'il n'est pas public. */
  lookup(actor: Actor, reference: string): Promise<{ readonly profileId: string; readonly name: string; readonly following: boolean; readonly own: boolean } | null>;
  following(actor: Actor): Promise<{ readonly profiles: readonly FollowedProfile[]; readonly companies: readonly FollowedCompany[] }>;
  /** Les abonnés du profil de l'acteur ; `null` s'il n'a pas de profil. */
  followers(actor: Actor): Promise<Followers | null>;
}

const Uuid = z.uuid();
const Reference = z.string().trim().toUpperCase().regex(/^FR-[A-Z0-9]{5,8}$/);
const MAX_FOLLOWERS_SHOWN = 500;

const PUBLISHED = { visibility: { not: "private" as const }, ...LISTED_PROFILE };

export const peopleFollows = (db: Db): PeopleFollows => ({
  async follow(actor, rawReference, now) {
    const reference = Reference.safeParse(rawReference);
    if (!reference.success) return "absent";
    return db.$transaction(async (tx): Promise<ProfileFollowResult> => {
      const profile = await tx.freelanceProfile.findFirst({ where: { reference: reference.data, ...PUBLISHED }, select: { id: true, userId: true } });
      if (profile === null) return "absent";
      if (profile.userId === actor.userId) return "self";
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
      if ((await tx.profileFollow.count({ where: { userId: actor.userId, profileId: profile.id } })) > 0) return "already";
      if ((await tx.profileFollow.count({ where: { userId: actor.userId } })) >= MAX_FOLLOWED_PROFILES) return "limit";
      await tx.profileFollow.create({ data: { userId: actor.userId, profileId: profile.id, createdAt: now } });
      await notifyCommunity(tx, [profile.userId], actor.userId, "new_follower", {});
      return "followed";
    });
  },

  async unfollow(actor, profileId) {
    if (!Uuid.safeParse(profileId).success) return false;
    const { count } = await db.profileFollow.deleteMany({ where: { userId: actor.userId, profileId } });
    return count === 1;
  },

  async lookup(actor, rawReference) {
    const reference = Reference.safeParse(rawReference);
    if (!reference.success) return null;
    const profile = await db.freelanceProfile.findFirst({ where: { reference: reference.data, ...PUBLISHED }, select: { id: true, userId: true, reference: true, visibility: true, user: { select: { displayName: true } } } });
    if (profile === null || profile.visibility === "private") return null;
    const following = await db.profileFollow.count({ where: { userId: actor.userId, profileId: profile.id } });
    return { profileId: profile.id, name: publicName(profile.visibility, profile.user.displayName) ?? profile.reference, following: following > 0, own: profile.userId === actor.userId };
  },

  async following(actor) {
    const [rows, companies] = await Promise.all([
      db.profileFollow.findMany({
        where: { userId: actor.userId },
        orderBy: [{ createdAt: "desc" }, { profileId: "asc" }],
        take: MAX_FOLLOWED_PROFILES,
        select: { createdAt: true, profile: { select: { id: true, reference: true, slug: true, visibility: true, moderatedAt: true, user: { select: { displayName: true, suspendedAt: true } } } } },
      }),
      companyFollows(db).listMine(actor),
    ]);
    const profiles = rows.map(({ createdAt, profile: p }) => {
      const published = p.visibility !== "private" && p.moderatedAt === null && p.user.suspendedAt === null;
      return {
        profileId: p.id,
        reference: p.reference,
        name: (published && p.visibility !== "private" ? publicName(p.visibility, p.user.displayName) : null) ?? p.reference,
        slug: published ? p.slug : null,
        followedAt: createdAt,
      };
    });
    return { profiles, companies };
  },

  async followers(actor) {
    const mine = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (mine === null) return null;
    const [total, rows] = await Promise.all([
      db.profileFollow.count({ where: { profileId: mine.id } }),
      db.profileFollow.findMany({
        where: { profileId: mine.id, user: { freelanceProfile: { is: PUBLISHED } } },
        orderBy: [{ createdAt: "desc" }, { userId: "asc" }],
        take: MAX_FOLLOWERS_SHOWN,
        select: { createdAt: true, user: { select: { displayName: true, freelanceProfile: { select: { reference: true, slug: true, visibility: true } } } } },
      }),
    ]);
    const shown = rows.flatMap(({ createdAt, user }) => {
      const p = user.freelanceProfile;
      if (p === null || p.slug === null || p.visibility === "private") return [];
      return [{ reference: p.reference, name: publicName(p.visibility, user.displayName) ?? p.reference, slug: p.slug, followedAt: createdAt }];
    });
    return { total, shown };
  },
});
