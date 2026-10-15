import { z } from "zod";
import type { Db } from "./client";
import type { StoredFileKind } from "./generated/enums";
import type { Actor } from "./messaging";

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
 * - l'image d'une réalisation du portfolio est publique dès que le profil est publié ;
 * - un CV n'est lu que par son propriétaire.
 *
 * Quotas par compte, comptés sous verrou du compte : deux dépôts simultanés ne passent pas tous deux sous la limite.
 */

export const FILE_QUOTA = { maxFiles: 30, maxBytes: 40 * 1024 * 1024 } as const;

/** Taille maximale enregistrée par usage (après réencodage pour les images). */
export const MAX_FILE_BYTES: Readonly<Record<StoredFileKind, number>> = { photo: 2 * 1024 * 1024, portfolio_image: 2 * 1024 * 1024, cv: 5 * 1024 * 1024 };

export const STORED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export const NewStoredFileSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["photo", "cv", "portfolio_image"]),
    contentType: z.enum(STORED_CONTENT_TYPES),
    size: z.number().int().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    width: z.number().int().min(1).nullable().default(null),
    height: z.number().int().min(1).nullable().default(null),
  })
  .refine((f) => f.size <= MAX_FILE_BYTES[f.kind], { message: "fichier trop lourd" })
  .refine((f) => (f.kind === "cv") === (f.contentType === "application/pdf"), { message: "type inattendu pour cet usage" });

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

/** Un fichier lisible, et pour qui : `public` peut être mis en cache partagé, `owner` jamais. */
export interface ReadableFile {
  readonly file: StoredFileRecord;
  readonly audience: "public" | "owner";
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
  /** Supprime un fichier de l'acteur ; rend son identifiant, ou `null` s'il n'est pas à lui. */
  remove(actor: Actor, id: string): Promise<string | null>;
  /** Les identifiants de tous les fichiers d'un compte : à effacer du disque avec lui. */
  idsOfOwner(userId: string): Promise<readonly string[]>;
  /** Ce qui est dit d'un fichier dans l'export RGPD : jamais le contenu, qui se télécharge depuis l'application. */
  listForExport(userId: string): Promise<readonly Omit<StoredFileRecord, "ownerId">[]>;
}

const Uuid = z.uuid();

const SELECT = { id: true, ownerId: true, kind: true, contentType: true, size: true, sha256: true, width: true, height: true, createdAt: true } as const;

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
      select: { ...SELECT, photoOf: { select: { visibility: true } }, portfolioOf: { select: { profile: { select: { visibility: true } } } } },
    });
    if (row === null) return null;
    const { photoOf, portfolioOf, ...file } = row;
    if (row.kind === "photo" && photoOf?.visibility === "named") return { file, audience: "public" };
    if (row.kind === "portfolio_image" && portfolioOf !== null && portfolioOf.profile.visibility !== "private") return { file, audience: "public" };
    return viewer !== null && row.ownerId === viewer.userId ? { file, audience: "owner" } : null;
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
});
