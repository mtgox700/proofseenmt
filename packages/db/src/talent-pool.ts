import { z } from "zod";
import type { Db } from "./client";
import type { Actor } from "./messaging";
import { SETTLED_PAYMENT } from "./reviews";

/*
 * Le vivier privé d'une entreprise : les freelances qu'elle a déjà payés (lus dans les contrats) et ceux qui ont
 * accepté son invitation (C23), présentés par des faits, triés par date, jamais par un score (AI Act).
 *
 * Un profil masqué par un opérateur, ou d'un compte suspendu, n'y figure pas. Un profil privé y figure par sa seule
 * référence : l'entreprise connaît déjà la personne (elle l'a payée, ou la personne a accepté de la rejoindre), mais le
 * titre et les compétences d'un brouillon non publié ne sont pas à elle. L'exclure ferait perdre de vue un freelance
 * avec qui l'on travaille, sans rien protéger de plus que la référence.
 *
 * Le freelance quitte un vivier rejoint par invitation quand il veut ; un administrateur de l'entreprise peut l'en
 * retirer. Le vivier des freelances payés, lui, est un fait des contrats : il ne se quitte pas.
 */

const Uuid = z.uuid();
const ADMINS = ["owner", "admin"] as const;
const POOL_LIMIT = 2_000;

export interface PoolMember {
  readonly profileId: string;
  readonly reference: string;
  /** Nul pour un profil privé : seule sa référence est montrée. */
  readonly headline: string | null;
  readonly skills: readonly string[];
  /** Missions payées (paiement acquis) avec cette entreprise. */
  readonly paidMissions: number;
  readonly totalDays: number;
  /** Nulle pour un freelance entré par invitation, sans mission payée avec l'entreprise. */
  readonly lastMissionStartedOn: Date | null;
  /** Date d'entrée par une invitation acceptée (C23) ; nulle pour un freelance seulement connu par ses missions. */
  readonly invitedOn: Date | null;
}

export interface JoinedPool {
  readonly organisationId: string;
  readonly name: string;
  readonly joinedAt: Date;
}

/** Les profils qui peuvent figurer dans un vivier : ni masqués par un opérateur, ni d'un compte suspendu. */
const LISTABLE_PROFILE = { moderatedAt: null, user: { suspendedAt: null } } as const;

const PROFILE_SELECT = { id: true, reference: true, headline: true, visibility: true, skills: { select: { skill: { select: { label: true } } } } } as const;

interface ProfileRow {
  readonly id: string;
  readonly reference: string;
  readonly headline: string | null;
  readonly visibility: string;
  readonly skills: readonly { readonly skill: { readonly label: string } }[];
}

const identity = (p: ProfileRow) => {
  const shown = p.visibility !== "private";
  return { profileId: p.id, reference: p.reference, headline: shown ? p.headline : null, skills: shown ? p.skills.map((s) => s.skill.label) : [] };
};

/** La date qui classe un freelance du vivier : sa dernière mission payée, sinon son entrée par invitation. */
const latestFact = (m: PoolMember): number => Math.max(m.lastMissionStartedOn?.getTime() ?? 0, m.invitedOn?.getTime() ?? 0);

export const talentPool = (db: Db) => ({
  /** Le vivier d'une entreprise, pour ses membres ; `null` pour les autres. Le plus récent d'abord. */
  async list(actor: Actor, organisationId: string): Promise<readonly PoolMember[] | null> {
    if (!Uuid.safeParse(organisationId).success) return null;
    if ((await db.membership.count({ where: { organisationId, userId: actor.userId } })) === 0) return null;
    const [paid, invited] = await Promise.all([
      db.contract.findMany({
        where: { organisationId, profile: { is: LISTABLE_PROFILE }, payments: { some: SETTLED_PAYMENT } },
        select: { days: true, startsOn: true, profile: { select: PROFILE_SELECT } },
        take: POOL_LIMIT,
      }),
      db.talentPoolEntry.findMany({
        where: { organisationId, user: { suspendedAt: null, freelanceProfile: { is: { moderatedAt: null } } } },
        select: { joinedAt: true, user: { select: { freelanceProfile: { select: PROFILE_SELECT } } } },
        take: POOL_LIMIT,
      }),
    ]);
    const byProfile = new Map<string, PoolMember>();
    for (const row of paid) {
      if (row.profile === null) continue;
      const known = byProfile.get(row.profile.id);
      const last = known?.lastMissionStartedOn ?? null;
      byProfile.set(row.profile.id, {
        ...identity(row.profile),
        paidMissions: (known?.paidMissions ?? 0) + 1,
        totalDays: (known?.totalDays ?? 0) + row.days,
        lastMissionStartedOn: last === null || row.startsOn > last ? row.startsOn : last,
        invitedOn: null,
      });
    }
    for (const entry of invited) {
      const profile = entry.user.freelanceProfile;
      if (profile === null) continue;
      const known = byProfile.get(profile.id);
      byProfile.set(profile.id, known === undefined ? { ...identity(profile), paidMissions: 0, totalDays: 0, lastMissionStartedOn: null, invitedOn: entry.joinedAt } : { ...known, invitedOn: entry.joinedAt });
    }
    return [...byProfile.values()].sort((a, b) => latestFact(b) - latestFact(a) || a.reference.localeCompare(b.reference));
  },

  /** Les viviers que le freelance a rejoints par invitation, pour qu'il puisse les quitter. */
  async joined(actor: Actor): Promise<readonly JoinedPool[]> {
    const rows = await db.talentPoolEntry.findMany({
      where: { userId: actor.userId },
      orderBy: { joinedAt: "desc" },
      take: 200,
      select: { organisationId: true, joinedAt: true, organisation: { select: { name: true } } },
    });
    return rows.map((r) => ({ organisationId: r.organisationId, name: r.organisation.name, joinedAt: r.joinedAt }));
  },

  /** Le freelance quitte un vivier rejoint par invitation. Seulement le sien : l'acteur est la personne elle-même. */
  async leave(actor: Actor, organisationId: string): Promise<boolean> {
    if (!Uuid.safeParse(organisationId).success) return false;
    const { count } = await db.talentPoolEntry.deleteMany({ where: { organisationId, userId: actor.userId } });
    return count === 1;
  },

  /** Un propriétaire ou administrateur retire de son vivier un freelance entré par invitation, désigné par son profil. */
  async remove(actor: Actor, organisationId: string, profileId: string): Promise<boolean> {
    if (!Uuid.safeParse(organisationId).success || !Uuid.safeParse(profileId).success) return false;
    const { count } = await db.talentPoolEntry.deleteMany({
      where: {
        organisationId,
        user: { freelanceProfile: { is: { id: profileId } } },
        organisation: { members: { some: { userId: actor.userId, role: { in: [...ADMINS] } } } },
      },
    });
    return count === 1;
  },
});
