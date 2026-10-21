import { z } from "zod";
import { countListAdd } from "./audience-stats";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { AvailabilityStatus, ListReaction, MemberRole, WorkMode } from "./generated/enums";
import type { Actor } from "./messaging";
import { publicName } from "./public-profiles";
import { isListedProfile, LISTED_PROFILE } from "./public-visibility";

/*
 * Listes de freelances d'une entreprise : favoris, présélections, partagées par tous ses membres. Chaque ligne porte une
 * note privée de l'entreprise et le pouce (levé ou baissé) de chaque membre. C'est l'avis d'un collègue sur un candidat
 * pour cette entreprise : jamais montré au freelance, jamais public, jamais additionné entre entreprises, jamais
 * transformé en ordre — la liste reste dans l'ordre d'ajout (AI Act).
 *
 * L'accès est vérifié dans chaque requête par l'appartenance à l'entreprise : la liste d'une autre entreprise est
 * absente, comme une liste qui n'existe pas. Un freelance qui efface son compte disparaît de toutes les listes
 * (cascade) ; un freelance qui retire son profil reste dans la liste par sa seule référence, sans ses faits.
 *
 * Plafonds : 50 listes par entreprise, 200 freelances par liste, comptés sous verrou de l'entreprise ou de la liste.
 */

export const MAX_LISTS_PER_ORGANISATION = 50;
export const MAX_ITEMS_PER_LIST = 200;

export const ListNameSchema = z.string().trim().min(1).max(80);
/** Une note vide efface la note. */
export const ListNoteSchema = z
  .string()
  .trim()
  .max(2000)
  .transform((note) => (note === "" ? null : note));

const Uuid = z.uuid();
const ADMINS: readonly MemberRole[] = ["owner", "admin"];

export interface ListSummary {
  readonly id: string;
  readonly name: string;
  readonly itemCount: number;
  readonly createdAt: Date;
  /** Nom du collègue qui l'a créée ; `null` s'il a quitté la plateforme. */
  readonly createdByName: string | null;
  /** L'acteur peut la supprimer : il l'a créée, ou il administre l'entreprise. */
  readonly removable: boolean;
}

export interface ListedProfile {
  readonly itemId: string;
  readonly profileId: string;
  readonly reference: string;
  /** Faux quand le freelance a retiré son profil depuis : ses faits ne sont plus montrés. */
  readonly published: boolean;
  readonly slug: string | null;
  /** Présent pour un profil nominatif publié seulement. */
  readonly displayName?: string;
  readonly headline: string | null;
  readonly city: string | null;
  readonly workMode: WorkMode | null;
  readonly dailyRateCents: number | null;
  readonly currency: string;
  readonly availability: AvailabilityStatus | null;
  readonly availableFrom: Date | null;
  /** Dernière confirmation de la disponibilité : au-delà de 30 jours, l'écran l'affiche « non confirmée » (C23). */
  readonly availabilityAt: Date | null;
  readonly skills: readonly string[];
  readonly note: string | null;
  readonly addedByName: string | null;
  readonly addedAt: Date;
  readonly ups: number;
  readonly downs: number;
  readonly myReaction: ListReaction | null;
}

export interface ListDetail {
  readonly id: string;
  readonly name: string;
  readonly organisationId: string;
  readonly createdAt: Date;
  readonly removable: boolean;
  readonly items: readonly ListedProfile[];
}

export type CreateListResult = { readonly kind: "created"; readonly id: string } | { readonly kind: "absent" | "invalid" | "limit" };
export type AddItemResult = "added" | "already" | "absent" | "limit";
export type ListWriteResult = "saved" | "absent" | "invalid";

const memberOf = (userId: string) => ({ members: { some: { userId } } });
const visibleList = (userId: string) => ({ organisation: memberOf(userId) });
const visibleItem = (userId: string) => ({ list: visibleList(userId) });

/** Le créateur de la liste, ou un administrateur de l'entreprise. */
const removableBy = (userId: string) => ({
  OR: [{ createdByUserId: userId }, { organisation: { members: { some: { userId, role: { in: [...ADMINS] } } } } }],
});

const ITEM_SELECT = {
  id: true,
  note: true,
  createdAt: true,
  addedBy: { select: { displayName: true } },
  reactions: { select: { userId: true, reaction: true } },
  profile: {
    select: {
      id: true,
      reference: true,
      slug: true,
      visibility: true,
      headline: true,
      city: true,
      workMode: true,
      dailyRateCents: true,
      currency: true,
      availability: true,
      availableFrom: true,
      availabilityAt: true,
      moderatedAt: true,
      user: { select: { displayName: true, suspendedAt: true } },
      skills: { select: { skill: { select: { label: true } } } },
    },
  },
} as const;

type ItemRow = Prisma.FreelanceListItemGetPayload<{ select: typeof ITEM_SELECT }>;

/** Une clé étrangère manquante (code Prisma P2003) : la ligne visée a été supprimée entre-temps. */
const isMissingReference = (error: unknown): boolean => typeof error === "object" && error !== null && "code" in error && error.code === "P2003";

const toListed = (row: ItemRow, userId: string): ListedProfile => {
  const p = row.profile;
  // Masqué par un opérateur ou compte suspendu : la ligne reste, réduite à la référence (revue vague 3, L9).
  const published = p.visibility !== "private" && isListedProfile(p);
  const name = published ? publicName(p.visibility, p.user.displayName) : null;
  return {
    itemId: row.id,
    profileId: p.id,
    reference: p.reference,
    published,
    slug: published ? p.slug : null,
    ...(name === null ? {} : { displayName: name }),
    headline: published ? p.headline : null,
    city: published ? p.city : null,
    workMode: published ? p.workMode : null,
    dailyRateCents: published ? p.dailyRateCents : null,
    currency: p.currency,
    availability: published ? p.availability : null,
    availableFrom: published ? p.availableFrom : null,
    availabilityAt: published ? p.availabilityAt : null,
    // L'ordre déclaré par le freelance, comme sur sa fiche publique et sa carte (revue Kensa, M3).
    skills: published ? p.skills.map((s) => s.skill.label) : [],
    note: row.note,
    addedByName: row.addedBy?.displayName ?? null,
    addedAt: row.createdAt,
    ups: row.reactions.filter((r) => r.reaction === "up").length,
    downs: row.reactions.filter((r) => r.reaction === "down").length,
    myReaction: row.reactions.find((r) => r.userId === userId)?.reaction ?? null,
  };
};

export const freelanceLists = (db: Db) => ({
  /** Les listes de l'entreprise, la plus récente d'abord ; `null` si l'acteur n'en est pas membre. */
  async lists(actor: Actor, organisationId: string): Promise<readonly ListSummary[] | null> {
    if (!Uuid.safeParse(organisationId).success) return null;
    if ((await db.membership.count({ where: { organisationId, userId: actor.userId } })) === 0) return null;
    const [rows, removable] = await Promise.all([
      db.freelanceList.findMany({
        where: { organisationId, ...visibleList(actor.userId) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: MAX_LISTS_PER_ORGANISATION,
        select: { id: true, name: true, createdAt: true, createdBy: { select: { displayName: true } }, _count: { select: { items: true } } },
      }),
      db.freelanceList.findMany({ where: { organisationId, ...visibleList(actor.userId), ...removableBy(actor.userId) }, select: { id: true } }),
    ]);
    const mine = new Set(removable.map((r) => r.id));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      itemCount: r._count.items,
      createdAt: r.createdAt,
      createdByName: r.createdBy?.displayName ?? null,
      removable: mine.has(r.id),
    }));
  },

  async create(actor: Actor, organisationId: string, rawName: string): Promise<CreateListResult> {
    if (!Uuid.safeParse(organisationId).success) return { kind: "absent" };
    const name = ListNameSchema.safeParse(rawName);
    if (!name.success) return { kind: "invalid" };
    return db.$transaction(async (tx): Promise<CreateListResult> => {
      if ((await tx.membership.count({ where: { organisationId, userId: actor.userId } })) === 0) return { kind: "absent" };
      // Deux créations simultanées attendent leur tour : le plafond tient.
      await tx.$queryRaw`SELECT "id" FROM "Organisation" WHERE "id" = ${organisationId}::uuid FOR UPDATE`;
      if ((await tx.freelanceList.count({ where: { organisationId } })) >= MAX_LISTS_PER_ORGANISATION) return { kind: "limit" };
      const { id } = await tx.freelanceList.create({ data: { organisationId, name: name.data, createdByUserId: actor.userId }, select: { id: true } });
      return { kind: "created", id };
    });
  },

  /** Supprime une liste ; seuls son créateur et les administrateurs de l'entreprise le peuvent. */
  async remove(actor: Actor, listId: string): Promise<boolean> {
    if (!Uuid.safeParse(listId).success) return false;
    const { count } = await db.freelanceList.deleteMany({ where: { id: listId, ...visibleList(actor.userId), ...removableBy(actor.userId) } });
    return count === 1;
  },

  /** Une liste et ses freelances, dans l'ordre d'ajout (le plus récent d'abord) ; `null` hors de l'entreprise. */
  async detail(actor: Actor, listId: string): Promise<ListDetail | null> {
    if (!Uuid.safeParse(listId).success) return null;
    const row = await db.freelanceList.findFirst({
      where: { id: listId, ...visibleList(actor.userId) },
      select: {
        id: true,
        name: true,
        organisationId: true,
        createdAt: true,
        items: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: MAX_ITEMS_PER_LIST, select: ITEM_SELECT },
      },
    });
    if (row === null) return null;
    const removable = (await db.freelanceList.count({ where: { id: listId, ...removableBy(actor.userId) } })) === 1;
    return { id: row.id, name: row.name, organisationId: row.organisationId, createdAt: row.createdAt, removable, items: row.items.map((item) => toListed(item, actor.userId)) };
  },

  /** Ajoute un profil publié à une liste de l'entreprise de l'acteur. */
  async addItem(actor: Actor, listId: string, profileId: string): Promise<AddItemResult> {
    if (!Uuid.safeParse(listId).success || !Uuid.safeParse(profileId).success) return "absent";
    try {
      return await db.$transaction(async (tx): Promise<AddItemResult> => {
        if ((await tx.freelanceList.count({ where: { id: listId, ...visibleList(actor.userId) } })) === 0) return "absent";
        if ((await tx.freelanceProfile.count({ where: { id: profileId, visibility: { not: "private" }, ...LISTED_PROFILE } })) === 0) return "absent";
        // Sous verrou de la liste : deux ajouts simultanés ne dépassent pas le plafond et ne se doublent pas.
        await tx.$queryRaw`SELECT "id" FROM "FreelanceList" WHERE "id" = ${listId}::uuid FOR UPDATE`;
        if ((await tx.freelanceListItem.count({ where: { listId, profileId } })) > 0) return "already";
        if ((await tx.freelanceListItem.count({ where: { listId } })) >= MAX_ITEMS_PER_LIST) return "limit";
        await tx.freelanceListItem.create({ data: { listId, profileId, addedByUserId: actor.userId } });
        // L'audience du profil compte l'ajout, jamais l'entreprise qui l'a fait.
        await countListAdd(tx, profileId, new Date());
        return "added";
      });
    } catch (error) {
      if (isUniqueViolation(error)) return "already";
      throw error;
    }
  },

  async removeItem(actor: Actor, itemId: string): Promise<boolean> {
    if (!Uuid.safeParse(itemId).success) return false;
    const { count } = await db.freelanceListItem.deleteMany({ where: { id: itemId, ...visibleItem(actor.userId) } });
    return count === 1;
  },

  /** La note privée de l'entreprise sur une ligne ; une note vide l'efface. */
  async setNote(actor: Actor, itemId: string, rawNote: string): Promise<ListWriteResult> {
    if (!Uuid.safeParse(itemId).success) return "absent";
    const note = ListNoteSchema.safeParse(rawNote);
    if (!note.success) return "invalid";
    const { count } = await db.freelanceListItem.updateMany({ where: { id: itemId, ...visibleItem(actor.userId) }, data: { note: note.data } });
    return count === 1 ? "saved" : "absent";
  },

  /** Le pouce de l'acteur sur une ligne ; `null` le retire. */
  async react(actor: Actor, itemId: string, reaction: ListReaction | null): Promise<ListWriteResult> {
    if (!Uuid.safeParse(itemId).success) return "absent";
    if ((await db.freelanceListItem.count({ where: { id: itemId, ...visibleItem(actor.userId) } })) === 0) return "absent";
    if (reaction === null) {
      await db.freelanceListReaction.deleteMany({ where: { itemId, userId: actor.userId } });
      return "saved";
    }
    try {
      await db.freelanceListReaction.upsert({
        where: { itemId_userId: { itemId, userId: actor.userId } },
        create: { itemId, userId: actor.userId, reaction },
        update: { reaction },
      });
      return "saved";
    } catch (error) {
      // Un collègue a retiré la ligne entre la vérification et l'écriture.
      if (isMissingReference(error)) return "absent";
      throw error;
    }
  },
});

export type FreelanceLists = ReturnType<typeof freelanceLists>;
