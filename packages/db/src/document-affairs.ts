import { z } from "zod";
import { LegalSnapshotSchema, type LegalSnapshot } from "./billing";
import type { Db } from "./client";
import type { ContractBilling, ContractStatus, DocumentType, QuoteStatus } from "./generated/enums";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";

/*
 * L'affaire d'un document, et qui peut la voir. Une affaire est un contrat, un devis, une conversation (accord de
 * confidentialité avant contrat), une entreprise ou un profil. Une personne n'y accède que si elle en est partie :
 *  - contrat : le freelance du contrat, ou un membre de l'entreprise ;
 *  - devis : les deux parties de sa conversation, mais l'entreprise ne voit jamais un brouillon ;
 *  - conversation : ses deux parties ;
 *  - entreprise : ses membres ; profil : son titulaire.
 * Toute autre personne n'apprend rien : « pas partie » et « n'existe pas » se répondent pareil (404), pour qu'aucun
 * identifiant ne puisse être sondé.
 *
 * Les règles de ce qu'on peut ranger (un contrat sans objet n'a pas de contrat de prestation, un devis envoyé…) sont
 * ici aussi : elles lisent les mêmes faits que ceux remis au moteur de rendu.
 */

export const AFFAIR_KINDS = ["contract", "quote", "conversation", "organisation", "profile"] as const;
export type AffairKind = (typeof AFFAIR_KINDS)[number];

export interface Affair {
  readonly kind: AffairKind;
  readonly id: string;
}

export const AffairSchema = z.object({ kind: z.enum(AFFAIR_KINDS), id: z.uuid() });

export type PartyRole = "freelance" | "company";

/** Les faits d'un contrat remis au rendu : ce que les parties ont accepté, jamais ce qui se lit ailleurs. */
export interface ContractFacts {
  readonly id: string;
  readonly status: ContractStatus;
  readonly billing: ContractBilling;
  readonly dailyRateCents: number;
  readonly days: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly startsOn: Date;
  readonly endsOn: Date | null;
  readonly scope: string | null;
  readonly deliverables: readonly string[];
  readonly commissionBp: number | null;
  readonly seller: LegalSnapshot;
  readonly buyer: LegalSnapshot;
  readonly acceptedByFreelanceAt: Date | null;
  readonly acceptedByOrgAt: Date | null;
  readonly createdAt: Date;
}

export interface QuoteFacts {
  readonly id: string;
  readonly status: QuoteStatus;
  readonly billing: ContractBilling;
  readonly dailyRateCents: number;
  readonly days: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly scope: string | null;
  readonly deliverables: readonly string[];
  readonly validUntil: Date | null;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
}

export type AffairFacts = { readonly kind: "contract"; readonly contract: ContractFacts } | { readonly kind: "quote"; readonly quote: QuoteFacts } | { readonly kind: "other"; readonly affair: Affair };

/** Qui est la personne dans l'affaire, avec les faits de l'affaire ; `null` si elle n'en est pas partie (ou si elle n'existe pas). */
export interface Access {
  readonly role: PartyRole;
  readonly facts: AffairFacts;
}

type Reader = Db | Prisma.TransactionClient;

const CONVERSATION_PARTY = (userId: string) => ({ OR: [{ profile: { userId } }, { organisation: { members: { some: { userId } } } }] });

const roleIn = (freelanceUserId: string | null | undefined, actor: Actor): PartyRole => (freelanceUserId === actor.userId ? "freelance" : "company");

export const accessTo = async (db: Reader, actor: Actor, affair: Affair): Promise<Access | null> => {
  switch (affair.kind) {
    case "contract": {
      const row = await db.contract.findFirst({
        where: { id: affair.id, OR: [{ profile: { userId: actor.userId } }, { organisation: { members: { some: { userId: actor.userId } } } }] },
        select: {
          id: true, status: true, billing: true, dailyRateCents: true, days: true, totalCents: true, currency: true, startsOn: true, endsOn: true, scope: true, deliverables: true,
          commissionBp: true, sellerSnapshot: true, buyerSnapshot: true, acceptedByFreelanceAt: true, acceptedByOrgAt: true, createdAt: true, profile: { select: { userId: true } },
        },
      });
      if (row === null) return null;
      const { sellerSnapshot, buyerSnapshot, profile, ...rest } = row;
      return { role: roleIn(profile?.userId, actor), facts: { kind: "contract", contract: { ...rest, seller: LegalSnapshotSchema.parse(sellerSnapshot), buyer: LegalSnapshotSchema.parse(buyerSnapshot) } } };
    }
    case "quote": {
      const row = await db.quote.findFirst({
        where: { id: affair.id, conversation: CONVERSATION_PARTY(actor.userId) },
        select: {
          id: true, status: true, billing: true, dailyRateCents: true, days: true, totalCents: true, currency: true, scope: true, deliverables: true, validUntil: true, acceptedAt: true, createdAt: true,
          conversation: { select: { profile: { select: { userId: true } } } },
        },
      });
      if (row === null) return null;
      const { conversation, ...quote } = row;
      const role = roleIn(conversation.profile.userId, actor);
      // L'entreprise ne voit pas un brouillon : ni le devis, ni ses documents.
      if (role === "company" && quote.status === "draft") return null;
      return { role, facts: { kind: "quote", quote } };
    }
    case "conversation": {
      const row = await db.conversation.findFirst({ where: { id: affair.id, ...CONVERSATION_PARTY(actor.userId) }, select: { profile: { select: { userId: true } } } });
      return row === null ? null : { role: roleIn(row.profile.userId, actor), facts: { kind: "other", affair } };
    }
    case "organisation": {
      const member = await db.membership.count({ where: { organisationId: affair.id, userId: actor.userId } });
      return member === 0 ? null : { role: "company", facts: { kind: "other", affair } };
    }
    case "profile": {
      const mine = await db.freelanceProfile.count({ where: { id: affair.id, userId: actor.userId } });
      return mine === 0 ? null : { role: "freelance", facts: { kind: "other", affair } };
    }
  }
};

/** De quel côté de l'affaire est chaque auteur de version (identifiant de personne vers côté) ; absent : plus partie de l'affaire. */
export type AuthorSides = ReadonlyMap<string, PartyRole>;

/** Le freelance et l'entreprise d'une affaire (nuls quand l'affaire n'en a pas, ou qu'ils ont disparu). */
const partiesOf = async (db: Reader, affair: Affair): Promise<{ readonly freelanceUserId: string | null; readonly organisationId: string | null }> => {
  const conversation = { select: { organisationId: true, profile: { select: { userId: true } } } } as const;
  switch (affair.kind) {
    case "contract": {
      const row = await db.contract.findUnique({ where: { id: affair.id }, select: { organisationId: true, profile: { select: { userId: true } } } });
      return { freelanceUserId: row?.profile?.userId ?? null, organisationId: row?.organisationId ?? null };
    }
    case "quote": {
      const row = await db.quote.findUnique({ where: { id: affair.id }, select: { conversation } });
      return { freelanceUserId: row?.conversation.profile.userId ?? null, organisationId: row?.conversation.organisationId ?? null };
    }
    case "conversation": {
      const row = await db.conversation.findUnique({ where: { id: affair.id }, ...conversation });
      return { freelanceUserId: row?.profile.userId ?? null, organisationId: row?.organisationId ?? null };
    }
    case "organisation":
      return { freelanceUserId: null, organisationId: affair.id };
    case "profile": {
      const row = await db.freelanceProfile.findUnique({ where: { id: affair.id }, select: { userId: true } });
      return { freelanceUserId: row?.userId ?? null, organisationId: null };
    }
  }
};

/**
 * Le côté de chacun de ces auteurs dans l'affaire : « freelance » s'il en est le freelance, « company » s'il est membre de
 * son entreprise. Sert à dire « vous », « un collègue de votre entreprise » ou « l'autre partie » sans donner un nom.
 */
export const authorSides = async (db: Reader, affair: Affair, authorIds: readonly (string | null)[]): Promise<AuthorSides> => {
  const ids = [...new Set(authorIds.filter((id): id is string => id !== null))];
  const sides = new Map<string, PartyRole>();
  if (ids.length === 0) return sides;
  const parties = await partiesOf(db, affair);
  if (parties.organisationId !== null) {
    const members = await db.membership.findMany({ where: { organisationId: parties.organisationId, userId: { in: ids } }, select: { userId: true } });
    for (const member of members) sides.set(member.userId, "company");
  }
  if (parties.freelanceUserId !== null && ids.includes(parties.freelanceUserId)) sides.set(parties.freelanceUserId, "freelance");
  return sides;
};

/** L'affaire à laquelle un document tient (la seule attache non nulle), ou `null` si elle a disparu (compte supprimé). */
export const affairOf = (anchors: { readonly contractId: string | null; readonly quoteId: string | null; readonly conversationId: string | null; readonly organisationId: string | null; readonly profileId: string | null }): Affair | null => {
  if (anchors.contractId !== null) return { kind: "contract", id: anchors.contractId };
  if (anchors.quoteId !== null) return { kind: "quote", id: anchors.quoteId };
  if (anchors.conversationId !== null) return { kind: "conversation", id: anchors.conversationId };
  if (anchors.organisationId !== null) return { kind: "organisation", id: anchors.organisationId };
  if (anchors.profileId !== null) return { kind: "profile", id: anchors.profileId };
  return null;
};

/** Les cinq attaches d'un document pour cette affaire : la sienne, et nul pour les autres (un document tient à une seule affaire). */
export const anchorsOf = (affair: Affair): { contractId: string | null; quoteId: string | null; conversationId: string | null; organisationId: string | null; profileId: string | null } => ({
  contractId: affair.kind === "contract" ? affair.id : null,
  quoteId: affair.kind === "quote" ? affair.id : null,
  conversationId: affair.kind === "conversation" ? affair.id : null,
  organisationId: affair.kind === "organisation" ? affair.id : null,
  profileId: affair.kind === "profile" ? affair.id : null,
});

/** À quelles affaires chaque sorte de document peut tenir. */
const FITS: Readonly<Record<DocumentType, readonly AffairKind[]>> = {
  service_agreement: ["contract"],
  acceptance_report: ["contract"],
  amendment: ["contract"],
  quote: ["quote"],
  nda: ["conversation", "contract", "organisation"],
};

export type Refusal =
  /** Cette sorte de document ne tient pas à cette affaire. */
  | "invalid"
  /** L'objet de la prestation manque (contrat ou devis accepté sans objet, ce que tout devis écrit avant l'objet obligatoire permet) : rien à rendre, rien à inventer. */
  | "scope_missing"
  /** L'état de l'affaire ne permet plus (ou pas encore) cette version : le contrat de prestation ne se réécrit plus dès qu'une partie l'a accepté. */
  | "wrong_state";

/**
 * Peut-on ranger une version de cette sorte dans cette affaire, maintenant ? Un contrat signé avant la mise en service du
 * coffre n'a pas d'objet : on ne lui fabrique pas après coup un « contrat de prestation » que personne n'a signé.
 */
export const refusalFor = (type: DocumentType, affair: Affair, facts: AffairFacts): Refusal | null => {
  if (!FITS[type].includes(affair.kind)) return "invalid";
  if (facts.kind === "contract") {
    const c = facts.contract;
    if (type !== "nda" && c.scope === null) return "scope_missing";
    if (type === "service_agreement") return c.status === "pending_signatures" && c.acceptedByFreelanceAt === null && c.acceptedByOrgAt === null ? null : "wrong_state";
    if (type === "acceptance_report" || type === "amendment") return c.status === "active" ? null : "wrong_state";
  }
  if (facts.kind === "quote") {
    if (facts.quote.scope === null) return "scope_missing";
    return facts.quote.status === "sent" || facts.quote.status === "accepted" ? null : "wrong_state";
  }
  return null;
};
