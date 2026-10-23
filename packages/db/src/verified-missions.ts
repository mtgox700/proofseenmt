import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { ClientKind, EvidenceKind } from "./generated/enums";
import type { Actor } from "./messaging";
import { SETTLED_PAYMENT } from "./reviews";

/*
 * Missions vérifiées : un fait daté sur le profil public, qui ne naît jamais d'une simple déclaration du freelance.
 * Deux origines seulement :
 *  - la confirmation du client (`client_confirmation`), par une entreprise inscrite ou par un lien signé envoyé à son
 *    contact (voir `mission-confirmations.ts`) ;
 *  - un contrat payé sur Proofseen (`paid_on_platform`), enregistré au versement des fonds au freelance.
 *
 * Chaque origine porte une clé unique (la demande, le contrat) : rejouer la confirmation ou le versement ne crée
 * jamais une seconde mission.
 */

const MONTHS_MAX = 600;
const ROLE_MAX = 200;

/** Mois couverts, bornes comprises : de janvier à mars, trois mois. Jamais moins d'un, jamais plus de cinquante ans. */
export const monthsBetween = (start: Date, end: Date): number => {
  const span = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  return Math.max(1, Math.min(MONTHS_MAX, span));
};

export interface VerifiedMissionRecord {
  readonly id: string;
  readonly role: string;
  readonly clientKind: ClientKind;
  readonly durationMonths: number;
  readonly summary: string;
  readonly evidenceKind: EvidenceKind;
  readonly verifiedAt: Date;
  /** Publié seulement parce que le client l'a autorisé ; `null` sinon. */
  readonly clientName: string | null;
  /**
   * Qui a confirmé, comme la page publique le dit : l'entreprise inscrite (`company`) ou un contact chez le client par
   * lien signé (`contact`) ; `null` pour une mission qui ne vient pas d'une confirmation. Le domaine lui-même ne sort pas.
   */
  readonly confirmedBy: "company" | "contact" | null;
}

export interface ConfirmedMission {
  readonly confirmationId: string;
  readonly profileId: string;
  readonly role: string;
  readonly clientKind: ClientKind;
  readonly startedOn: Date;
  readonly endedOn: Date;
  readonly summary: string;
  /** Le nom déclaré ; gardé pour publication seulement si `showClientName`. */
  readonly clientName: string;
  readonly showClientName: boolean;
  readonly confirmedByOrganisationId: string | null;
  readonly confirmedByDomain: string | null;
}

/** La mission née d'une confirmation, dans la transaction de la décision. Une demande n'en crée jamais deux. */
export const createConfirmedMission = async (tx: Prisma.TransactionClient, m: ConfirmedMission, now: Date): Promise<void> => {
  await tx.verifiedMission.createMany({
    data: [
      {
        profileId: m.profileId,
        role: m.role,
        clientKind: m.clientKind,
        durationMonths: monthsBetween(m.startedOn, m.endedOn),
        summary: m.summary,
        evidenceKind: "client_confirmation",
        verifiedAt: now,
        confirmationId: m.confirmationId,
        clientName: m.showClientName ? m.clientName : null,
        confirmedByOrganisationId: m.confirmedByOrganisationId,
        confirmedByDomain: m.confirmedByDomain,
      },
    ],
    skipDuplicates: true,
  });
};

const truncate = (value: string, max: number): string => (value.length <= max ? value : value.slice(0, max).trimEnd());

/**
 * Enregistre la mission d'un contrat payé : fonds versés, sans remboursement ni litige ouvert. Idempotent (clé unique
 * sur le contrat). Le rôle est le titre de la mission publiée d'origine, à défaut le titre du profil ; le client reste
 * anonyme (son type seulement), et aucun résumé n'est inventé. Rend `true` si la mission existe après l'appel.
 */
export const recordPaidMission = async (db: Db, contractId: string, now: Date): Promise<boolean> => {
  const contract = await db.contract.findFirst({
    where: { id: contractId, status: "completed", profileId: { not: null }, organisationId: { not: null }, payments: { some: SETTLED_PAYMENT } },
    select: {
      profileId: true,
      startsOn: true,
      endsOn: true,
      organisation: { select: { kind: true } },
      profile: { select: { headline: true } },
      quote: { select: { conversation: { select: { application: { select: { jobPost: { select: { title: true } } } } } } } },
      payments: { where: SETTLED_PAYMENT, orderBy: { releasedAt: "asc" }, take: 1, select: { releasedAt: true } },
    },
  });
  if (contract === null || contract.profileId === null || contract.organisation === null) return false;
  const title = contract.quote?.conversation.application?.jobPost.title ?? contract.profile?.headline ?? null;
  if (title === null || title.trim().length < 2) return false;
  // Sans date de fin prévue, la mission s'arrête au versement : jamais une durée plus longue que ce qui a eu lieu.
  const end = contract.endsOn ?? contract.payments[0]?.releasedAt ?? now;
  await db.verifiedMission.createMany({
    data: [
      {
        profileId: contract.profileId,
        role: truncate(title.trim(), ROLE_MAX),
        clientKind: contract.organisation.kind,
        durationMonths: monthsBetween(contract.startsOn, end),
        summary: "",
        evidenceKind: "paid_on_platform",
        verifiedAt: now,
        contractId,
      },
    ],
    skipDuplicates: true,
  });
  return true;
};

const SELECT = { id: true, role: true, clientKind: true, durationMonths: true, summary: true, evidenceKind: true, verifiedAt: true, clientName: true, confirmedByDomain: true } as const;

export interface VerifiedMissions {
  /** Les missions vérifiées du freelance connecté, les plus récentes d'abord. */
  listMine(actor: Actor): Promise<readonly VerifiedMissionRecord[]>;
}

export const verifiedMissions = (db: Db): VerifiedMissions => ({
  async listMine(actor) {
    const rows = await db.verifiedMission.findMany({ where: { profile: { userId: actor.userId } }, orderBy: [{ verifiedAt: "desc" }, { id: "desc" }], select: SELECT });
    // La règle de la page publique (public-profiles.ts) : un contact quand un domaine a confirmé, sinon l'entreprise.
    return rows.map(({ confirmedByDomain, ...m }) => ({
      ...m,
      confirmedBy: m.evidenceKind !== "client_confirmation" ? null : confirmedByDomain === null ? "company" : "contact",
    }));
  },
});
