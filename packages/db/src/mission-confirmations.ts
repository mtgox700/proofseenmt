import { z } from "zod";
import type { Db } from "./client";
import { containsContact } from "./contact-detection";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { ClientKind, MissionConfirmationStatus } from "./generated/enums";
import type { Actor } from "./messaging";
import {
  CONFIRMATION_TTL_DAYS,
  ConfirmationInputSchema,
  confirmationTokenHash,
  emailDomain,
  mailboxKey,
  MAX_PENDING_CONFIRMATIONS,
  MAX_REQUESTS_PER_CONTACT,
  monthOf,
  TOKEN_FORMAT,
  type ConfirmationInput,
} from "./mission-confirmation-input";
import { notifications } from "./notifications";
import { createConfirmedMission } from "./verified-missions";

/*
 * Demandes de confirmation de missions passées. Le freelance déclare une mission ; seul le client la fait devenir un
 * fait vérifié :
 *  - entreprise inscrite (SIRET reconnu et actif au répertoire) : ses propriétaires et administrateurs confirment ou
 *    refusent depuis leur espace ;
 *  - sinon, un contact par e-mail, qui décide sans compte par un lien signé, à usage unique, valable trente jours. La
 *    base ne garde que l'empreinte du jeton ; le jeton se recalcule côté serveur à partir d'un secret qui n'est pas ici.
 *
 * Rien n'est publié avant la confirmation ; un refus ou une expiration ne laissent rien de public. Personne ne confirme
 * pour soi : ni son propre SIREN, ni une entreprise dont on est membre, ni sa propre adresse, ni celle d'un collègue.
 * Le contrôle d'accès est dans les requêtes : un identifiant étranger donne `not_found`, jamais un indice.
 */

const DAY_MS = 86_400_000;
const Uuid = z.uuid();
const ADMINS = ["owner", "admin"] as const;
const LIST_LIMIT = 50;

export type ConfirmationTarget = "organisation" | "email";
/** L'état vu par les personnes : une demande en attente au-delà de son échéance est expirée. */
export type ConfirmationState = "pending" | "expired" | "confirmed" | "refused";

export interface ConfirmationLink {
  /** Identifiant de la demande, tiré par l'appelant : le jeton du lien en dépend. */
  readonly id: string;
  readonly token: string;
}

export type RequestConfirmationResult =
  | { readonly kind: "requested"; readonly target: ConfirmationTarget }
  | { readonly kind: "invalid" }
  | { readonly kind: "no_profile" }
  | { readonly kind: "limit" }
  /** Une mission qui n'est pas encore terminée ne se confirme pas. */
  | { readonly kind: "future" }
  | { readonly kind: "self_confirmation" }
  /** SIRET inconnu de Proofseen (ou non vérifié) et aucune adresse de contact : personne à qui demander. */
  | { readonly kind: "contact_required" }
  /** Cette adresse a déjà reçu assez de demandes ces trente derniers jours. */
  | { readonly kind: "contact_limit" };

export interface MyConfirmationRequest {
  readonly id: string;
  readonly role: string;
  readonly clientName: string;
  readonly target: ConfirmationTarget;
  readonly state: ConfirmationState;
  readonly startedOn: Date;
  readonly endedOn: Date;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly decidedAt: Date | null;
}

/** Ce que voit celui qui confirme : la mission déclarée, et qui la déclare. Jamais une coordonnée du freelance. */
export interface ConfirmationView {
  readonly id: string;
  /** Nom affiché du freelance, ou sa référence publique si ce nom contient une coordonnée. */
  readonly freelancer: string;
  readonly reference: string;
  readonly role: string;
  readonly clientName: string;
  readonly startedOn: Date;
  readonly endedOn: Date;
  readonly summary: string;
  readonly expiresAt: Date;
}

export interface CompanyConfirmationRequest extends ConfirmationView {
  readonly organisationName: string;
}

/** Une réponse lue en base : ce que le client a décidé, et quand. Jamais tirée d'une adresse ni d'un formulaire. */
export interface RecordedDecision {
  readonly decision: "confirmed" | "refused";
  readonly decidedAt: Date;
}

export type TokenLookup =
  | { readonly kind: "open"; readonly view: ConfirmationView }
  | ({ readonly kind: "decided"; readonly view: ConfirmationView } & RecordedDecision)
  | { readonly kind: "expired" }
  | { readonly kind: "invalid" };

export type CompanyDecidedRequest = CompanyConfirmationRequest & RecordedDecision;

export interface Decision {
  readonly confirm: boolean;
  /** Le client autorise l'affichage du nom de son entreprise ; ignoré pour un refus. */
  readonly showClientName: boolean;
}

export type DecideResult = "confirmed" | "refused" | "expired" | "decided" | "not_found" | "self_confirmation";

export interface MissionConfirmations {
  request(actor: Actor, input: ConfirmationInput, link: ConfirmationLink, lang: "fr" | "en", now: Date): Promise<RequestConfirmationResult>;
  listMine(actor: Actor, now: Date): Promise<readonly MyConfirmationRequest[]>;
  /** Retire une demande encore en attente : le lien envoyé ne mène plus à rien. */
  withdraw(actor: Actor, id: string): Promise<boolean>;
  /** Les demandes en attente adressées aux entreprises que l'acteur administre. */
  listForCompany(actor: Actor, now: Date): Promise<readonly CompanyConfirmationRequest[]>;
  decideAsCompany(actor: Actor, id: string, decision: Decision, now: Date): Promise<DecideResult>;
  /** Une demande déjà décidée, adressée à une entreprise que l'acteur administre ; `null` pour toute autre. */
  decidedForCompany(actor: Actor, id: string): Promise<CompanyDecidedRequest | null>;
  /** La demande du lien signé, ouverte ou décidée (avec sa décision), pour qui détient le jeton et lui seul. */
  lookupByToken(id: string, token: string, now: Date): Promise<TokenLookup>;
  decideByToken(id: string, token: string, decision: Decision, now: Date): Promise<Exclude<DecideResult, "not_found" | "self_confirmation"> | "invalid">;
}

const stateOf = (status: MissionConfirmationStatus, expiresAt: Date, now: Date): ConfirmationState =>
  status === "pending" && expiresAt.getTime() <= now.getTime() ? "expired" : status;

const VIEW_SELECT = {
  id: true,
  role: true,
  clientName: true,
  startedOn: true,
  endedOn: true,
  summary: true,
  expiresAt: true,
  profile: { select: { reference: true, user: { select: { displayName: true } } } },
} as const;

type ViewRow = Prisma.MissionConfirmationRequestGetPayload<{ select: typeof VIEW_SELECT }>;

const viewOf = (row: ViewRow): ConfirmationView => ({
  id: row.id,
  freelancer: containsContact(row.profile.user.displayName) ? row.profile.reference : row.profile.user.displayName,
  reference: row.profile.reference,
  role: row.role,
  clientName: row.clientName,
  startedOn: row.startedOn,
  endedOn: row.endedOn,
  summary: row.summary,
  expiresAt: row.expiresAt,
});

/** La décision portée par la ligne ; `null` tant qu'elle est en attente (la base impose une date à toute décision). */
const recordedOf = (row: { readonly status: MissionConfirmationStatus; readonly decidedAt: Date | null }): RecordedDecision | null =>
  row.status === "pending" || row.decidedAt === null ? null : { decision: row.status, decidedAt: row.decidedAt };

/** Les demandes adressées à une entreprise que l'acteur administre, dont il n'est pas lui-même le freelance. */
const administered = (userId: string): Prisma.MissionConfirmationRequestWhereInput => ({
  organisation: { members: { some: { userId, role: { in: [...ADMINS] } } } },
  NOT: { profile: { userId } },
});

interface Freelancer {
  readonly profileId: string;
  readonly email: string;
  readonly organisationIds: readonly string[];
  readonly siret: string | null;
}

/** Demandes récentes vers cette boîte, sous-adresses comprises (« dsi+1@x.fr » arrive chez « dsi@x.fr »). */
const recentToMailbox = async (tx: Prisma.TransactionClient, email: string, now: Date): Promise<number> => {
  const at = email.lastIndexOf("@");
  const base = email.slice(0, at).replace(/\+.*$/, "");
  const domain = email.slice(at + 1);
  return tx.missionConfirmationRequest.count({
    where: {
      createdAt: { gt: new Date(now.getTime() - CONFIRMATION_TTL_DAYS * DAY_MS) },
      OR: [{ contactEmail: `${base}@${domain}` }, { contactEmail: { startsWith: `${base}+`, endsWith: `@${domain}` } }],
    },
  });
};

/** Personne ne confirme pour soi : même SIREN, entreprise dont on est membre, sa propre adresse ou celle d'un collègue. */
const selfTarget = async (tx: Prisma.TransactionClient, f: Freelancer, siret: string | null, orgId: string | null, email: string | null): Promise<boolean> => {
  if (siret !== null && f.siret !== null && siret.slice(0, 9) === f.siret.slice(0, 9)) return true;
  if (orgId !== null) return f.organisationIds.includes(orgId);
  if (email === null) return false;
  if (mailboxKey(email) === mailboxKey(f.email)) return true;
  if (f.organisationIds.length === 0) return false;
  return (await tx.membership.count({ where: { organisationId: { in: [...f.organisationIds] }, user: { email } } })) > 0;
};

const notifyFreelancer = async (db: Db, tx: Prisma.TransactionClient, profileId: string, confirmed: boolean): Promise<void> => {
  const { userId } = await tx.freelanceProfile.findUniqueOrThrow({ where: { id: profileId }, select: { userId: true } });
  await notifications(db).enqueue(tx, [userId], "mission_confirmation", { status: confirmed ? "confirmed" : "refused" });
};

const DECISION_SELECT = {
  id: true,
  profileId: true,
  role: true,
  clientName: true,
  clientKind: true,
  startedOn: true,
  endedOn: true,
  summary: true,
  status: true,
  expiresAt: true,
  organisationId: true,
  contactEmail: true,
  organisation: { select: { name: true } },
} as const;

type DecisionRow = Prisma.MissionConfirmationRequestGetPayload<{ select: typeof DECISION_SELECT }>;

/**
 * Applique une décision sur une demande encore en attente et non échue, en une instruction conditionnelle : deux
 * décisions simultanées (deux administrateurs, deux clics sur le lien) n'en font jamais qu'une.
 */
const applyDecision = async (db: Db, tx: Prisma.TransactionClient, row: DecisionRow, decision: Decision, decidedByUserId: string | null, now: Date): Promise<"confirmed" | "refused" | "decided"> => {
  const { count } = await tx.missionConfirmationRequest.updateMany({
    where: { id: row.id, status: "pending", expiresAt: { gt: now } },
    data: { status: decision.confirm ? "confirmed" : "refused", decidedAt: now, decidedByUserId, showClientName: decision.confirm && decision.showClientName },
  });
  if (count === 0) return "decided";
  if (decision.confirm) {
    await createConfirmedMission(
      tx,
      {
        confirmationId: row.id,
        profileId: row.profileId,
        role: row.role,
        clientKind: row.clientKind,
        startedOn: row.startedOn,
        endedOn: row.endedOn,
        summary: row.summary,
        // Une entreprise inscrite autorise son propre nom, jamais le texte libre saisi par le freelance.
        clientName: row.organisation?.name ?? row.clientName,
        showClientName: decision.showClientName,
        confirmedByOrganisationId: row.organisationId,
        confirmedByDomain: row.contactEmail === null ? null : emailDomain(row.contactEmail),
      },
      now,
    );
  }
  await notifyFreelancer(db, tx, row.profileId, decision.confirm);
  return decision.confirm ? "confirmed" : "refused";
};

const pendingState = (row: { readonly status: MissionConfirmationStatus; readonly expiresAt: Date }, now: Date): "open" | "expired" | "decided" => {
  if (row.status !== "pending") return "decided";
  return row.expiresAt.getTime() <= now.getTime() ? "expired" : "open";
};

interface Target {
  readonly organisation: { readonly id: string; readonly kind: ClientKind } | null;
}

const findTarget = async (tx: Prisma.TransactionClient, siret: string | null): Promise<Target> => {
  // Seule une entreprise dont le SIRET est actif au répertoire, sous son nom, décide pour ce SIRET : un SIRET saisi par
  // n'importe qui à la création d'une entreprise ne suffit pas.
  const organisation = siret === null ? null : await tx.organisation.findFirst({ where: { siret, registryStatus: "active" }, select: { id: true, kind: true } });
  return { organisation };
};

export const missionConfirmations = (db: Db): MissionConfirmations => ({
  async request(actor, raw, link, lang, now) {
    const parsed = ConfirmationInputSchema.safeParse(raw);
    if (!parsed.success || !Uuid.safeParse(link.id).success || !TOKEN_FORMAT.test(link.token)) return { kind: "invalid" };
    const input = parsed.data;
    if (input.endedOn.getTime() > monthOf(now).getTime()) return { kind: "future" };
    try {
      return await db.$transaction(async (tx): Promise<RequestConfirmationResult> => {
        const profile = await tx.freelanceProfile.findUnique({
          where: { userId: actor.userId },
          select: { id: true, billing: { select: { siret: true } }, user: { select: { email: true, memberships: { select: { organisationId: true } } } } },
        });
        if (profile === null) return { kind: "no_profile" };
        // Verrou du profil : deux demandes simultanées ne dépassent pas le plafond ensemble.
        await tx.$queryRaw`SELECT "id" FROM "FreelanceProfile" WHERE "id" = ${profile.id}::uuid FOR UPDATE`;
        const pending = await tx.missionConfirmationRequest.count({ where: { profileId: profile.id, status: "pending", expiresAt: { gt: now } } });
        if (pending >= MAX_PENDING_CONFIRMATIONS) return { kind: "limit" };
        const freelancer: Freelancer = { profileId: profile.id, email: profile.user.email, organisationIds: profile.user.memberships.map((m) => m.organisationId), siret: profile.billing?.siret ?? null };
        const { organisation } = await findTarget(tx, input.clientSiret);
        const email = organisation === null ? input.contactEmail : null;
        if (organisation === null && email === null) return { kind: "contact_required" };
        if (await selfTarget(tx, freelancer, input.clientSiret, organisation?.id ?? null, email)) return { kind: "self_confirmation" };
        if (email !== null && (await recentToMailbox(tx, email, now)) >= MAX_REQUESTS_PER_CONTACT) return { kind: "contact_limit" };
        const common = {
          id: link.id,
          profileId: profile.id,
          role: input.role,
          clientName: input.clientName,
          clientSiret: input.clientSiret,
          clientKind: organisation?.kind ?? input.clientKind,
          startedOn: input.startedOn,
          endedOn: input.endedOn,
          summary: input.summary,
          lang,
          expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_DAYS * DAY_MS),
          createdAt: now,
        };
        if (organisation !== null) {
          await tx.missionConfirmationRequest.create({ data: { ...common, organisationId: organisation.id }, select: { id: true } });
          const admins = await tx.membership.findMany({ where: { organisationId: organisation.id, role: { in: [...ADMINS] } }, select: { userId: true } });
          await notifications(db).enqueue(tx, admins.map((a) => a.userId), "mission_confirmation", { status: "requested" });
          return { kind: "requested", target: "organisation" };
        }
        await tx.missionConfirmationRequest.create({ data: { ...common, contactEmail: email, tokenHash: confirmationTokenHash(link.token), emailSendAfter: now }, select: { id: true } });
        return { kind: "requested", target: "email" };
      });
    } catch (error) {
      // Identifiant ou jeton déjà pris : la demande n'est pas créée, l'appelant en tire un autre.
      if (isUniqueViolation(error)) return { kind: "invalid" };
      throw error;
    }
  },

  async listMine(actor, now) {
    const rows = await db.missionConfirmationRequest.findMany({
      where: { profile: { userId: actor.userId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: LIST_LIMIT,
      select: { id: true, role: true, clientName: true, organisationId: true, status: true, startedOn: true, endedOn: true, createdAt: true, expiresAt: true, decidedAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      clientName: r.clientName,
      target: r.organisationId === null ? "email" : "organisation",
      state: stateOf(r.status, r.expiresAt, now),
      startedOn: r.startedOn,
      endedOn: r.endedOn,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      decidedAt: r.decidedAt,
    }));
  },

  async withdraw(actor, id) {
    if (!Uuid.safeParse(id).success) return false;
    const { count } = await db.missionConfirmationRequest.deleteMany({ where: { id, status: "pending", profile: { userId: actor.userId } } });
    return count === 1;
  },

  async listForCompany(actor, now) {
    const rows = await db.missionConfirmationRequest.findMany({
      where: { ...administered(actor.userId), status: "pending", expiresAt: { gt: now } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: LIST_LIMIT,
      select: { ...VIEW_SELECT, organisation: { select: { name: true } } },
    });
    return rows.map((row) => ({ ...viewOf(row), organisationName: row.organisation?.name ?? "" }));
  },

  async decideAsCompany(actor, id, decision, now) {
    if (!Uuid.safeParse(id).success) return "not_found";
    return db.$transaction(async (tx): Promise<DecideResult> => {
      const row = await tx.missionConfirmationRequest.findFirst({
        where: { id, ...administered(actor.userId) },
        select: { ...DECISION_SELECT, profile: { select: { user: { select: { memberships: { select: { organisationId: true } } } } } } },
      });
      if (row === null) return "not_found";
      const state = pendingState(row, now);
      if (state !== "open") return state;
      // Le freelance a pu rejoindre l'entreprise depuis sa demande : il ne la confirmerait pas mieux de l'intérieur.
      if (row.profile.user.memberships.some((m) => m.organisationId === row.organisationId)) return "self_confirmation";
      return applyDecision(db, tx, row, decision, actor.userId, now);
    });
  },

  async decidedForCompany(actor, id) {
    if (!Uuid.safeParse(id).success) return null;
    const row = await db.missionConfirmationRequest.findFirst({
      where: { id, ...administered(actor.userId), status: { in: ["confirmed", "refused"] } },
      select: { ...VIEW_SELECT, status: true, decidedAt: true, organisation: { select: { name: true } } },
    });
    const recorded = row === null ? null : recordedOf(row);
    if (row === null || recorded === null) return null;
    return { ...viewOf(row), organisationName: row.organisation?.name ?? "", ...recorded };
  },

  async lookupByToken(id, token, now) {
    if (!Uuid.safeParse(id).success || !TOKEN_FORMAT.test(token)) return { kind: "invalid" };
    const row = await db.missionConfirmationRequest.findFirst({ where: { id, tokenHash: confirmationTokenHash(token) }, select: { ...VIEW_SELECT, status: true, decidedAt: true } });
    if (row === null) return { kind: "invalid" };
    const state = pendingState(row, now);
    if (state === "open") return { kind: "open", view: viewOf(row) };
    if (state === "expired") return { kind: "expired" };
    const recorded = recordedOf(row);
    return recorded === null ? { kind: "invalid" } : { kind: "decided", view: viewOf(row), ...recorded };
  },

  async decideByToken(id, token, decision, now) {
    if (!Uuid.safeParse(id).success || !TOKEN_FORMAT.test(token)) return "invalid";
    return db.$transaction(async (tx) => {
      const row = await tx.missionConfirmationRequest.findFirst({ where: { id, tokenHash: confirmationTokenHash(token) }, select: DECISION_SELECT });
      if (row === null) return "invalid";
      const state = pendingState(row, now);
      if (state !== "open") return state;
      return applyDecision(db, tx, row, decision, null, now);
    });
  },
});
