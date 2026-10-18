import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { MemberRole } from "./generated/enums";
import type { Actor } from "./messaging";
import { notifications } from "./notifications";
import { ProfileSearchSchema, fullWhere, searchProfiles } from "./profile-search";

/*
 * Recherches de freelances enregistrées par une entreprise (C22). Comme les listes, elles appartiennent à l'entreprise
 * et se partagent entre ses membres ; chacune garde l'adresse de la recherche (`query`, relue telle quelle par l'écran)
 * et ses filtres validés (`filters`, rejoués par l'alerte).
 *
 * Alerte facultative, quotidienne, pour le seul créateur : les profils publiés qui répondent aux filtres et qu'il n'a pas
 * encore reçus (SavedSearchSeen), en une notification. À l'activation, les profils qui répondent déjà sont marqués vus :
 * l'alerte ne renvoie pas tout le stock. Un créateur qui quitte l'entreprise ou dont le compte est suspendu ne reçoit plus
 * rien, et son alerte s'éteint.
 *
 * L'accès est vérifié dans chaque requête par l'appartenance à l'entreprise : la recherche d'une autre entreprise est
 * absente, comme une recherche qui n'existe pas. Suppression : le créateur ou un administrateur.
 */

export const MAX_SAVED_SEARCHES_PER_ORGANISATION = 30;
export const MAX_SEARCH_ALERTS_PER_USER = 10;
/** Une alerte repart au plus une fois par jour. */
export const SEARCH_ALERT_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Profils cités au plus dans une même notification, et lus au plus à chaque passage. */
const MAX_MATCHES = 10;
const SCAN_PAGE = 50;
/** Profils marqués vus au plus à l'activation d'une alerte. */
const MAX_SEED = 1000;
const SCAN_BATCH = 100;

const Uuid = z.uuid();
const ADMINS: readonly MemberRole[] = ["owner", "admin"];

export const SavedSearchNameSchema = z.string().trim().min(1).max(80);
/** L'adresse de la recherche, sans « ? » : seulement des paramètres. */
export const SavedQuerySchema = z.string().max(2000).refine((q) => !q.startsWith("?") && !/[\s#]/.test(q), { message: "paramètres d'adresse attendus" });

/** Les filtres gardés : ceux de la recherche, sans l'ordre ni la page ; la date en AAAA-MM-JJ, lisible en JSON. */
export const SavedFiltersSchema = ProfileSearchSchema.omit({ sort: true, page: true, pageSize: true, availableBy: true }).extend({ availableBy: z.iso.date().optional() });
export type SavedFilters = z.input<typeof SavedFiltersSchema>;

export interface SavedSearchInput {
  readonly name: string;
  readonly query: string;
  readonly filters: SavedFilters;
  readonly alert: boolean;
}

export interface SavedSearchSummary {
  readonly id: string;
  readonly name: string;
  readonly query: string;
  readonly alert: boolean;
  readonly createdAt: Date;
  /** Nom du collègue qui l'a enregistrée ; `null` s'il a quitté la plateforme. */
  readonly createdByName: string | null;
  /** L'acteur l'a enregistrée : lui seul règle l'alerte, qu'il reçoit. */
  readonly mine: boolean;
  /** L'acteur peut la supprimer : il l'a créée, ou il administre l'entreprise. */
  readonly removable: boolean;
}

export type CreateSavedSearchResult = { readonly kind: "created"; readonly id: string } | { readonly kind: "invalid" | "limit" | "alert_limit" | "absent" };
export type AlertResult = "saved" | "limit" | "absent";

export interface SavedSearches {
  create(actor: Actor, organisationId: string, input: SavedSearchInput, now: Date): Promise<CreateSavedSearchResult>;
  list(actor: Actor, organisationId: string): Promise<readonly SavedSearchSummary[] | null>;
  /** L'adresse d'une recherche de l'une des entreprises de l'acteur ; `null` sinon. */
  query(actor: Actor, savedSearchId: string): Promise<string | null>;
  setAlert(actor: Actor, savedSearchId: string, alert: boolean, now: Date): Promise<AlertResult>;
  remove(actor: Actor, savedSearchId: string): Promise<boolean>;
  /** Rejoue les alertes dues ; rend le nombre de notifications mises en file. */
  scan(now: Date): Promise<number>;
}

/** Les filtres gardés, sous la forme que la recherche attend. */
const searchOf = (saved: z.output<typeof SavedFiltersSchema>) => {
  const { availableBy, ...rest } = saved;
  return { ...rest, ...(availableBy === undefined ? {} : { availableBy: new Date(`${availableBy}T00:00:00Z`) }) };
};

/** Les profils qui répondent déjà, marqués vus : une alerte neuve ne renvoie pas le stock existant. */
const seed = async (db: Db, savedSearchId: string, filters: z.output<typeof SavedFiltersSchema>, now: Date): Promise<void> => {
  const where = await fullWhere(db, ProfileSearchSchema.parse(searchOf(filters)), now);
  const rows = await db.freelanceProfile.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: MAX_SEED, select: { id: true } });
  if (rows.length > 0) await db.savedSearchSeen.createMany({ data: rows.map((r) => ({ savedSearchId, profileId: r.id })), skipDuplicates: true });
};

const memberOf = (actor: Actor): Prisma.OrganisationWhereInput => ({ members: { some: { userId: actor.userId } } });

export const savedSearches = (db: Db): SavedSearches => ({
  async create(actor, organisationId, input, now) {
    if (!Uuid.safeParse(organisationId).success) return { kind: "absent" };
    const name = SavedSearchNameSchema.safeParse(input.name);
    const query = SavedQuerySchema.safeParse(input.query);
    const filters = SavedFiltersSchema.safeParse(input.filters);
    if (!name.success || !query.success || !filters.success) return { kind: "invalid" };
    const result = await db.$transaction(async (tx): Promise<CreateSavedSearchResult> => {
      if ((await tx.membership.count({ where: { organisationId, userId: actor.userId } })) === 0) return { kind: "absent" };
      // Deux enregistrements simultanés attendent leur tour : les plafonds tiennent.
      await tx.$queryRaw`SELECT "id" FROM "Organisation" WHERE "id" = ${organisationId}::uuid FOR UPDATE`;
      if ((await tx.savedSearch.count({ where: { organisationId } })) >= MAX_SAVED_SEARCHES_PER_ORGANISATION) return { kind: "limit" };
      if (input.alert && (await tx.savedSearch.count({ where: { createdByUserId: actor.userId, alert: true } })) >= MAX_SEARCH_ALERTS_PER_USER) return { kind: "alert_limit" };
      const { id } = await tx.savedSearch.create({
        data: { organisationId, createdByUserId: actor.userId, name: name.data, query: query.data, filters: filters.data as Prisma.InputJsonObject, alert: input.alert, lastCheckedAt: now },
        select: { id: true },
      });
      return { kind: "created", id };
    });
    if (result.kind === "created" && input.alert) await seed(db, result.id, filters.data, now);
    return result;
  },

  async list(actor, organisationId) {
    if (!Uuid.safeParse(organisationId).success) return null;
    const membership = await db.membership.findUnique({ where: { organisationId_userId: { organisationId, userId: actor.userId } }, select: { role: true } });
    if (membership === null) return null;
    const admin = ADMINS.includes(membership.role);
    const rows = await db.savedSearch.findMany({
      where: { organisationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, query: true, alert: true, createdAt: true, createdByUserId: true, createdBy: { select: { displayName: true } } },
    });
    return rows.map((r) => {
      const mine = r.createdByUserId === actor.userId;
      return { id: r.id, name: r.name, query: r.query, alert: r.alert, createdAt: r.createdAt, createdByName: r.createdBy?.displayName ?? null, mine, removable: mine || admin };
    });
  },

  async query(actor, savedSearchId) {
    if (!Uuid.safeParse(savedSearchId).success) return null;
    const row = await db.savedSearch.findFirst({ where: { id: savedSearchId, organisation: memberOf(actor) }, select: { query: true } });
    return row?.query ?? null;
  },

  async setAlert(actor, savedSearchId, alert, now) {
    if (!Uuid.safeParse(savedSearchId).success) return "absent";
    const outcome = await db.$transaction(async (tx): Promise<{ readonly result: AlertResult; readonly filters: Prisma.JsonValue | null }> => {
      // Seul le créateur, encore membre, règle l'alerte : c'est lui qui la reçoit.
      const row = await tx.savedSearch.findFirst({ where: { id: savedSearchId, createdByUserId: actor.userId, organisation: memberOf(actor) }, select: { alert: true, filters: true } });
      if (row === null) return { result: "absent", filters: null };
      if (row.alert === alert) return { result: "saved", filters: null };
      if (alert) {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
        if ((await tx.savedSearch.count({ where: { createdByUserId: actor.userId, alert: true } })) >= MAX_SEARCH_ALERTS_PER_USER) return { result: "limit", filters: null };
      }
      await tx.savedSearch.update({ where: { id: savedSearchId }, data: { alert, lastCheckedAt: now } });
      return { result: "saved", filters: alert ? row.filters : null };
    });
    if (outcome.filters !== null) {
      const parsed = SavedFiltersSchema.safeParse(outcome.filters);
      if (parsed.success) await seed(db, savedSearchId, parsed.data, now);
    }
    return outcome.result;
  },

  async remove(actor, savedSearchId) {
    if (!Uuid.safeParse(savedSearchId).success) return false;
    const { count } = await db.savedSearch.deleteMany({
      where: {
        id: savedSearchId,
        OR: [
          { createdByUserId: actor.userId, organisation: memberOf(actor) },
          { organisation: { members: { some: { userId: actor.userId, role: { in: [...ADMINS] } } } } },
        ],
      },
    });
    return count === 1;
  },

  async scan(now) {
    const due = await db.savedSearch.findMany({
      where: { alert: true, lastCheckedAt: { lte: new Date(now.getTime() - SEARCH_ALERT_INTERVAL_MS) } },
      orderBy: { lastCheckedAt: "asc" },
      take: SCAN_BATCH,
      select: { id: true, organisationId: true, createdByUserId: true, filters: true, organisation: { select: { suspendedAt: true } }, createdBy: { select: { suspendedAt: true } } },
    });
    let queued = 0;
    for (const alert of due) {
      const creator = alert.createdByUserId;
      const member = creator === null ? 0 : await db.membership.count({ where: { organisationId: alert.organisationId, userId: creator } });
      const parsed = SavedFiltersSchema.safeParse(alert.filters);
      // Créateur parti, compte ou entreprise suspendus, filtres devenus illisibles : l'alerte s'éteint, sans rien envoyer.
      if (creator === null || member === 0 || alert.createdBy?.suspendedAt != null || alert.organisation.suspendedAt !== null || !parsed.success) {
        await db.savedSearch.update({ where: { id: alert.id }, data: { alert: false, lastCheckedAt: now } });
        continue;
      }
      const page = await searchProfiles(db, { ...searchOf(parsed.data), sort: "recent", page: 1, pageSize: SCAN_PAGE }, now);
      queued += await db.$transaction(async (tx) => {
        await tx.savedSearch.update({ where: { id: alert.id }, data: { lastCheckedAt: now } });
        const seen = await tx.savedSearchSeen.findMany({ where: { savedSearchId: alert.id, profileId: { in: page.items.map((p) => p.id) } }, select: { profileId: true } });
        const already = new Set(seen.map((s) => s.profileId));
        const fresh = page.items.filter((p) => !already.has(p.id) && p.slug !== null);
        if (fresh.length === 0) return 0;
        await tx.savedSearchSeen.createMany({ data: fresh.map((p) => ({ savedSearchId: alert.id, profileId: p.id })), skipDuplicates: true });
        return notifications(db).enqueue(tx, [creator], "profile_match", { savedSearchId: alert.id, slugs: fresh.slice(0, MAX_MATCHES).flatMap((p) => (p.slug === null ? [] : [p.slug])) });
      });
    }
    return queued;
  },
});
