import { z } from "zod";
import type { Db } from "./client";
import type { Actor } from "./messaging";
import { LISTED_COMPANY, LISTED_MISSION } from "./public-visibility";

/*
 * Entreprises suivies. On ne suit qu'une entreprise qui a une page publique, et jamais la sienne ; chaque mission
 * qu'elle publie ensuite est signalée (notification `company_mission`, envoyée à la publication). La liste est privée :
 * l'entreprise ne sait pas qui la suit, elle n'en voit pas même le nombre.
 */

export const MAX_FOLLOWED_COMPANIES = 100;

const Uuid = z.uuid();
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type FollowResult = "followed" | "already" | "limit" | "absent";

export interface FollowedCompany {
  readonly organisationId: string;
  readonly name: string;
  /** Adresse de la page publique ; `null` si l'entreprise l'a retirée depuis. */
  readonly slug: string | null;
  readonly openMissions: number;
  readonly followedAt: Date;
}

export interface CompanyFollows {
  follow(actor: Actor, slug: string): Promise<FollowResult>;
  unfollow(actor: Actor, organisationId: string): Promise<boolean>;
  listMine(actor: Actor): Promise<readonly FollowedCompany[]>;
  /** L'entreprise publique de cette adresse, et si l'acteur la suit déjà ; `null` si la page n'existe pas. */
  lookup(actor: Actor, slug: string): Promise<{ readonly organisationId: string; readonly name: string; readonly following: boolean; readonly member: boolean } | null>;
}

export const companyFollows = (db: Db): CompanyFollows => ({
  async follow(actor, slug) {
    if (!SLUG.test(slug)) return "absent";
    const org = await db.organisation.findFirst({
      where: { publicSlug: slug, publicSince: { not: null }, moderatedAt: null, members: { none: { userId: actor.userId } } },
      select: { id: true },
    });
    if (org === null) return "absent";
    const existing = await db.companyFollow.count({ where: { userId: actor.userId, organisationId: org.id } });
    if (existing > 0) return "already";
    if ((await db.companyFollow.count({ where: { userId: actor.userId } })) >= MAX_FOLLOWED_COMPANIES) return "limit";
    // Un double clic ne crée pas deux lignes : la clé primaire suffit, l'écriture est idempotente.
    await db.companyFollow.createMany({ data: [{ userId: actor.userId, organisationId: org.id }], skipDuplicates: true });
    return "followed";
  },

  async unfollow(actor, organisationId) {
    if (!Uuid.safeParse(organisationId).success) return false;
    const { count } = await db.companyFollow.deleteMany({ where: { userId: actor.userId, organisationId } });
    return count === 1;
  },

  async listMine(actor) {
    const rows = await db.companyFollow.findMany({
      where: { userId: actor.userId },
      orderBy: [{ createdAt: "desc" }, { organisationId: "asc" }],
      take: MAX_FOLLOWED_COMPANIES,
      select: {
        createdAt: true,
        organisation: {
          select: { id: true, name: true, publicName: true, publicSlug: true, publicSince: true, _count: { select: { jobPosts: { where: { status: "open", ...LISTED_MISSION } } } } },
        },
      },
    });
    return rows.map(({ createdAt, organisation: o }) => ({
      organisationId: o.id,
      name: o.publicName ?? o.name,
      slug: o.publicSince === null ? null : o.publicSlug,
      openMissions: o._count.jobPosts,
      followedAt: createdAt,
    }));
  },

  async lookup(actor, slug) {
    if (!SLUG.test(slug)) return null;
    const org = await db.organisation.findFirst({ where: { publicSlug: slug, publicSince: { not: null }, ...LISTED_COMPANY }, select: { id: true, publicName: true } });
    if (org === null || org.publicName === null) return null;
    const [following, member] = await Promise.all([
      db.companyFollow.count({ where: { userId: actor.userId, organisationId: org.id } }),
      db.membership.count({ where: { userId: actor.userId, organisationId: org.id } }),
    ]);
    return { organisationId: org.id, name: org.publicName, following: following > 0, member: member > 0 };
  },
});
