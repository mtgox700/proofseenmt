import { z } from "zod";
import type { Db } from "./client";
import type { PostVisibility, StoredFileKind } from "./generated/enums";
import type { Actor } from "./messaging";
import { LISTED_POST } from "./public-visibility";

/*
 * Les fichiers déposés : une ligne par fichier (propriétaire, usage, type reconnu, taille, empreinte), le contenu étant
 * rangé sur le disque du serveur par l'application sous l'identifiant de la ligne. Ce dépôt ne touche jamais le disque :
 * il dit quelles lignes existent, qui peut les lire, et quelles lignes il vient de supprimer pour que l'application
 * efface les fichiers correspondants.
 *
 * Qui lit quoi :
 * - le propriétaire lit tous ses fichiers ;
 * - une photo est publique seulement quand elle est la photo d'un profil publié sous le nom de la personne (un profil
 *   pseudonyme ne montre jamais de visage) ;
 * - l'image d'une réalisation du portfolio est publique seulement sur un profil publié sous le nom de la personne : une
 *   capture d'écran peut porter un nom, un logo client, un visage, et lèverait le pseudonyme ;
 * - un CV est lu par son propriétaire, et par les membres de l'entreprise qui publie la mission d'une candidature à
 *   laquelle il est joint (C21), tant que cette candidature n'est pas retirée, que la mission n'est pas masquée, que ni
 *   l'entreprise, ni le membre, ni le candidat ne sont suspendus ;
 * - une pièce jointe (C15) est lue par les parties du fil de son message, et par son auteur seul tant qu'elle n'est
 *   rattachée à aucun message ;
 * - l'image d'une publication (C22) suit la publication : publique si la publication l'est, lue par toute personne
 *   connectée si elle est réservée aux membres, jamais si elle est supprimée, masquée ou si son locuteur n'est plus
 *   public, ni sous un profil pseudonyme (une image peut porter un visage, un nom).
 *
 * Quotas par compte, comptés sous verrou du compte : deux dépôts simultanés ne passent pas tous deux sous la limite.
 */

export const FILE_QUOTA = { maxFiles: 30, maxBytes: 40 * 1024 * 1024 } as const;

/** Taille maximale enregistrée par usage (après réencodage pour les images). */
export const MAX_FILE_BYTES: Readonly<Record<StoredFileKind, number>> = { photo: 2 * 1024 * 1024, portfolio_image: 2 * 1024 * 1024, cv: 5 * 1024 * 1024, message_attachment: 5 * 1024 * 1024, post_image: 2 * 1024 * 1024 };

export const STORED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export const NewStoredFileSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["photo", "cv", "portfolio_image", "message_attachment", "post_image"]),
    contentType: z.enum(STORED_CONTENT_TYPES),
    size: z.number().int().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    width: z.number().int().min(1).nullable().default(null),
    height: z.number().int().min(1).nullable().default(null),
  })
  .refine((f) => f.size <= MAX_FILE_BYTES[f.kind], { message: "fichier trop lourd" })
  .refine((f) => f.kind === "message_attachment" || (f.kind === "cv") === (f.contentType === "application/pdf"), { message: "type inattendu pour cet usage" });

export type NewStoredFile = z.input<typeof NewStoredFileSchema>;

export interface StoredFileRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly kind: StoredFileKind;
  readonly contentType: string;
  readonly size: number;
  readonly sha256: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly createdAt: Date;
}

/**
 * Un fichier lisible, et pour qui : `public` peut être mis en cache partagé, les autres jamais. `recipient` : un membre
 * de l'entreprise destinataire d'une candidature qui joint ce CV. `member` : toute personne connectée (image d'une
 * publication réservée aux membres, C22).
 */
export interface ReadableFile {
  readonly file: StoredFileRecord;
  readonly audience: "public" | "owner" | "participant" | "recipient" | "member";
}

export type RecordResult = "recorded" | "quota" | "invalid";

export interface StoredFiles {
  /** Enregistre un fichier déjà écrit sur disque ; refusé au-delà du quota du compte. */
  record(actor: Actor, file: NewStoredFile): Promise<RecordResult>;
  /** Le fichier, si `viewer` (ou un anonyme, `null`) a le droit de le lire ; `null` sinon, comme un fichier inconnu. */
  readable(id: string, viewer: Actor | null): Promise<ReadableFile | null>;
  /** Le fichier de l'acteur, s'il lui appartient et qu'il est de cet usage. */
  mine(actor: Actor, id: string, kind: StoredFileKind): Promise<StoredFileRecord | null>;
  /** Le dernier fichier de cet usage déposé par l'acteur. */
  latest(actor: Actor, kind: StoredFileKind): Promise<StoredFileRecord | null>;
  /** Supprime les fichiers de l'acteur de cet usage, sauf `keepId` ; rend les identifiants supprimés. */
  removeKind(actor: Actor, kind: StoredFileKind, keepId?: string): Promise<readonly string[]>;
  /**
   * Garde le CV `keepId` de l'acteur (à défaut, le plus récent) et ceux joints à une candidature non retirée ; supprime
   * ses autres CV et rend leurs identifiants, à effacer du disque. Un CV envoyé à une entreprise reste celui qu'elle a reçu.
   */
  pruneCvs(actor: Actor, keepId?: string): Promise<readonly string[]>;
  /** Supprime un fichier de l'acteur ; rend son identifiant, ou `null` s'il n'est pas à lui. */
  remove(actor: Actor, id: string): Promise<string | null>;
  /** Les identifiants de tous les fichiers d'un compte : à effacer du disque avec lui. */
  idsOfOwner(userId: string): Promise<readonly string[]>;
  /** Ce qui est dit d'un fichier dans l'export RGPD : jamais le contenu, qui se télécharge depuis l'application. */
  listForExport(userId: string): Promise<readonly Omit<StoredFileRecord, "ownerId">[]>;
  /**
   * Supprime les pièces jointes restées sans message depuis `before` (envoi interrompu, message disparu) ; rend leurs
   * identifiants, pour effacer les fichiers du disque.
   */
  purgeOrphanAttachments(before: Date): Promise<readonly string[]>;
  /** La place occupée par tous les fichiers enregistrés, en octets : le plafond du volume se compare à ce total. */
  totalBytes(): Promise<number>;
  /** Parmi ces identifiants, ceux qui ont une ligne : un fichier sur disque sans ligne est orphelin. */
  existing(ids: readonly string[]): Promise<ReadonlySet<string>>;
}

const Uuid = z.uuid();
const IdRow = z.object({ id: z.string() });
/** Pièces jointes orphelines supprimées par passage de la tâche planifiée. */
const ORPHAN_BATCH = 500;

const SELECT = { id: true, ownerId: true, kind: true, contentType: true, size: true, sha256: true, width: true, height: true, createdAt: true } as const;

/** Un profil masqué par un opérateur, ou dont le titulaire est suspendu, ne publie plus ses images (C19). */
const PUBLIC_STATE = { visibility: true, moderatedAt: true, user: { select: { suspendedAt: true } } } as const;
const listed = (p: { readonly moderatedAt: Date | null; readonly user: { readonly suspendedAt: Date | null } }): boolean => p.moderatedAt === null && p.user.suspendedAt === null;

/**
 * Le lecteur est membre actif de l'entreprise destinataire d'une candidature vivante qui joint ce CV : vérifié dans la
 * requête, comme pour ouvrir la candidature elle-même. Une mission masquée, une entreprise ou un compte suspendus (C19)
 * ferment l'accès.
 */
const cvRecipient = async (db: Db, id: string, viewer: Actor): Promise<boolean> =>
  (await db.application.count({
    where: {
      cvFileId: id,
      status: { not: "withdrawn" },
      profile: { user: { suspendedAt: null } },
      jobPost: { moderatedAt: null, organisation: { suspendedAt: null, members: { some: { userId: viewer.userId, user: { suspendedAt: null } } } } },
    },
  })) > 0;

/**
 * L'image d'une publication vivante et listée, sous un profil nominatif ou une entreprise : sa visibilité (publique ou
 * membres), ou `null` si elle ne se montre à personne d'autre que son auteur.
 */
const postImageVisibility = async (db: Db, id: string): Promise<PostVisibility | null> => {
  const post = await db.post.findFirst({
    where: { AND: [{ imageFileId: id }, LISTED_POST, { OR: [{ organisationId: { not: null } }, { profile: { is: { visibility: "named" } } }] }] },
    select: { visibility: true },
  });
  return post?.visibility ?? null;
};

export const storedFiles = (db: Db): StoredFiles => ({
  async record(actor, raw) {
    const parsed = NewStoredFileSchema.safeParse(raw);
    if (!parsed.success) return "invalid";
    const file = parsed.data;
    return db.$transaction(async (tx): Promise<RecordResult> => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
      const used = await tx.storedFile.aggregate({ where: { ownerId: actor.userId }, _count: { _all: true }, _sum: { size: true } });
      if (used._count._all >= FILE_QUOTA.maxFiles || (used._sum.size ?? 0) + file.size > FILE_QUOTA.maxBytes) return "quota";
      await tx.storedFile.create({ data: { ...file, ownerId: actor.userId } });
      return "recorded";
    });
  },

  async readable(id, viewer) {
    if (!Uuid.safeParse(id).success) return null;
    const row = await db.storedFile.findUnique({
      where: { id },
      select: { ...SELECT, photoOf: { select: PUBLIC_STATE }, portfolioOf: { select: { profile: { select: PUBLIC_STATE } } } },
    });
    if (row === null) return null;
    const { photoOf, portfolioOf, ...file } = row;
    if (row.kind === "photo" && photoOf?.visibility === "named" && listed(photoOf)) return { file, audience: "public" };
    if (row.kind === "portfolio_image" && portfolioOf?.profile.visibility === "named" && listed(portfolioOf.profile)) return { file, audience: "public" };
    const shown = row.kind === "post_image" ? await postImageVisibility(db, id) : null;
    if (shown === "public") return { file, audience: "public" };
    if (viewer === null) return null;
    if (row.ownerId === viewer.userId) return { file, audience: "owner" };
    if (shown === "members") return { file, audience: "member" };
    if (row.kind === "cv") return (await cvRecipient(db, id, viewer)) ? { file, audience: "recipient" } : null;
    if (row.kind !== "message_attachment") return null;
    // Partie au fil du message qui porte la pièce jointe : vérifié dans la requête, comme pour lire le fil lui-même.
    const shared = await db.storedFile.count({
      where: {
        id,
        kind: "message_attachment",
        message: { conversation: { OR: [{ profile: { userId: viewer.userId } }, { organisation: { members: { some: { userId: viewer.userId } } } }] } },
      },
    });
    return shared === 1 ? { file, audience: "participant" } : null;
  },

  async mine(actor, id, kind) {
    if (!Uuid.safeParse(id).success) return null;
    return db.storedFile.findFirst({ where: { id, ownerId: actor.userId, kind }, select: SELECT });
  },

  latest(actor, kind) {
    return db.storedFile.findFirst({ where: { ownerId: actor.userId, kind }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: SELECT });
  },

  async removeKind(actor, kind, keepId) {
    return db.$transaction(async (tx) => {
      const rows = await tx.storedFile.findMany({ where: { ownerId: actor.userId, kind, ...(keepId === undefined ? {} : { id: { not: keepId } }) }, select: { id: true } });
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) await tx.storedFile.deleteMany({ where: { id: { in: ids }, ownerId: actor.userId } });
      return ids;
    });
  },

  async pruneCvs(actor, keepId) {
    if (keepId !== undefined && !Uuid.safeParse(keepId).success) return [];
    return db.$transaction(async (tx) => {
      const keep = keepId ?? (await tx.storedFile.findFirst({ where: { ownerId: actor.userId, kind: "cv" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } }))?.id;
      if (keep === undefined) return [];
      const rows = await tx.storedFile.findMany({
        where: { ownerId: actor.userId, kind: "cv", id: { not: keep }, applications: { none: { status: { not: "withdrawn" } } } },
        select: { id: true },
      });
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) await tx.storedFile.deleteMany({ where: { id: { in: ids }, ownerId: actor.userId } });
      return ids;
    });
  },

  async remove(actor, id) {
    if (!Uuid.safeParse(id).success) return null;
    const { count } = await db.storedFile.deleteMany({ where: { id, ownerId: actor.userId } });
    return count === 0 ? null : id;
  },

  async idsOfOwner(userId) {
    if (!Uuid.safeParse(userId).success) return [];
    return (await db.storedFile.findMany({ where: { ownerId: userId }, select: { id: true } })).map((r) => r.id);
  },

  async listForExport(userId) {
    if (!Uuid.safeParse(userId).success) return [];
    return db.storedFile.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, contentType: true, size: true, sha256: true, width: true, height: true, createdAt: true },
    });
  },

  async purgeOrphanAttachments(before) {
    // Une seule instruction, qui rend ce qu'elle a vraiment supprimé : une pièce jointe rattachée entre-temps à son
    // message reste, et son fichier avec elle.
    const rows = await db.$queryRaw<unknown[]>`
      DELETE FROM "StoredFile"
      WHERE "id" IN (
        SELECT "id" FROM "StoredFile"
        WHERE "kind"::text = 'message_attachment' AND "messageId" IS NULL AND "createdAt" < ${before}
        LIMIT ${ORPHAN_BATCH}
        FOR UPDATE SKIP LOCKED
      ) AND "messageId" IS NULL
      RETURNING "id"::text AS "id"`;
    return rows.map((raw) => IdRow.parse(raw).id);
  },

  async totalBytes() {
    // Les versions du coffre occupent le même volume : elles comptent dans son plafond.
    const [files, versions] = await Promise.all([db.storedFile.aggregate({ _sum: { size: true } }), db.documentVersion.aggregate({ _sum: { size: true } })]);
    return (files._sum.size ?? 0) + (versions._sum.size ?? 0);
  },

  async existing(ids) {
    const valid = ids.filter((id) => Uuid.safeParse(id).success);
    if (valid.length === 0) return new Set<string>();
    // Un fichier du coffre (version d'un document) n'a pas de ligne StoredFile : sans cette lecture, le balayage des fichiers
    // orphelins l'effacerait au bout d'une heure.
    const [files, versions] = await Promise.all([
      db.storedFile.findMany({ where: { id: { in: valid } }, select: { id: true } }),
      db.documentVersion.findMany({ where: { storageKey: { in: valid } }, select: { storageKey: true } }),
    ]);
    return new Set([...files.map((r) => r.id), ...versions.map((r) => r.storageKey)]);
  },
});
