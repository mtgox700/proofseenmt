import type { Db } from "./client";
import type { Actor } from "./messaging";

/*
 * Ce qu'une personne doit savoir des décisions d'un opérateur sur ses contenus (C19) : ce qui est masqué, depuis quand,
 * et pourquoi. Lu dans son propre espace, par son propre compte : le contrôle d'accès est dans la requête (ses profils,
 * les missions et les pages des entreprises dont elle est membre), jamais celles d'un autre.
 */

export interface ModerationNotice {
  readonly target: "profile" | "mission" | "company";
  readonly id: string;
  readonly label: string;
  readonly reason: string;
  readonly moderatedAt: Date;
}

export interface AccountStanding {
  readonly suspended: { readonly at: Date; readonly reason: string } | null;
  readonly notices: readonly ModerationNotice[];
  /** Attestation de vigilance refusée par un opérateur, à redéclarer. */
  readonly vigilanceRejection: { readonly at: Date; readonly reason: string } | null;
}

const MAX_NOTICES = 50;

export const accountNotices = (db: Db) => ({
  async standing(actor: Actor): Promise<AccountStanding> {
    const hidden = { moderatedAt: { not: null } };
    const [user, profile, missions, companies] = await Promise.all([
      db.user.findUnique({ where: { id: actor.userId }, select: { suspendedAt: true, suspensionReason: true } }),
      db.freelanceProfile.findUnique({
        where: { userId: actor.userId },
        select: { id: true, reference: true, moderatedAt: true, moderationReason: true, vigilance: { select: { rejectedAt: true, rejectionReason: true } } },
      }),
      db.jobPost.findMany({
        where: { ...hidden, organisation: { members: { some: { userId: actor.userId } } } },
        orderBy: [{ moderatedAt: "desc" }, { id: "desc" }],
        take: MAX_NOTICES,
        select: { id: true, title: true, moderatedAt: true, moderationReason: true },
      }),
      db.organisation.findMany({ where: { ...hidden, members: { some: { userId: actor.userId } } }, take: MAX_NOTICES, select: { id: true, name: true, moderatedAt: true, moderationReason: true } }),
    ]);
    const notice = (target: ModerationNotice["target"], id: string, label: string, at: Date | null, reason: string | null): ModerationNotice[] =>
      at === null || reason === null ? [] : [{ target, id, label, reason, moderatedAt: at }];
    const rejected = profile?.vigilance ?? null;
    return {
      suspended: user?.suspendedAt != null && user.suspensionReason != null ? { at: user.suspendedAt, reason: user.suspensionReason } : null,
      notices: [
        ...(profile === null ? [] : notice("profile", profile.id, profile.reference, profile.moderatedAt, profile.moderationReason)),
        ...missions.flatMap((m) => notice("mission", m.id, m.title, m.moderatedAt, m.moderationReason)),
        ...companies.flatMap((c) => notice("company", c.id, c.name, c.moderatedAt, c.moderationReason)),
      ],
      vigilanceRejection: rejected?.rejectedAt != null && rejected.rejectionReason != null ? { at: rejected.rejectedAt, reason: rejected.rejectionReason } : null,
    };
  },
});

export type AccountNotices = ReturnType<typeof accountNotices>;
