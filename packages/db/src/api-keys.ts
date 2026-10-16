import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Db } from "./client";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";

/*
 * Les clés d'API d'une entreprise : créées et révoquées par ses propriétaires et administrateurs, en lecture seule, et
 * limitées aux données de cette entreprise. La clé n'est montrée qu'une fois ; la base n'en garde que l'empreinte
 * SHA-256 (une clé de 256 bits tirée au hasard n'a pas besoin d'un hachage lent) et un préfixe pour la reconnaître.
 *
 * Une clé ne sert que tant que quelqu'un répond de l'entreprise (revue de sécurité vague 3, M6) : au moins un
 * propriétaire ou administrateur non suspendu, et l'entreprise pas masquée par un opérateur. La suspension d'un compte
 * révoque en plus les clés qu'il a créées (`user-desk.ts`).
 */

const Uuid = z.uuid();
const ADMIN_ROLES = ["owner", "admin"] as const;
const KEY_PREFIX = "psk_";
const KEY_FORMAT = /^psk_[A-Za-z0-9_-]{43}$/;
const SHOWN_PREFIX_LENGTH = 12;
/** Au-delà, une entreprise révoque avant d'en créer une autre : une clé oubliée est une clé qui fuit. */
export const MAX_ACTIVE_KEYS = 10;
/** La date de dernière utilisation n'est réécrite qu'une fois par minute, pour ne pas écrire à chaque appel. */
const LAST_USED_GRANULARITY_MS = 60_000;

export const ApiKeyNameSchema = z.string().trim().min(1).max(60);

export interface ApiKeySummary {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

export type CreateKeyResult =
  | { readonly kind: "created"; readonly key: string; readonly summary: ApiKeySummary }
  | { readonly kind: "too_many" }
  | { readonly kind: "absent" };

export interface ApiCaller {
  readonly keyId: string;
  readonly organisationId: string;
}

const hashOf = (key: string): string => createHash("sha256").update(key).digest("hex");

const SUMMARY = { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true } as const;

const adminOf = (actor: Actor) => ({ members: { some: { userId: actor.userId, role: { in: [...ADMIN_ROLES] } } } });

/** Une entreprise dont quelqu'un répond encore : pas masquée, et un propriétaire ou administrateur actif. */
const ANSWERABLE = { suspendedAt: null, members: { some: { role: { in: [...ADMIN_ROLES] }, user: { suspendedAt: null } } } } satisfies Prisma.OrganisationWhereInput;

export const apiKeys = (db: Db) => ({
  /** Crée une clé pour l'entreprise ; la clé en clair n'est rendue qu'ici. */
  async create(actor: Actor, organisationId: string, rawName: string, now: Date): Promise<CreateKeyResult> {
    if (!Uuid.safeParse(organisationId).success) return { kind: "absent" };
    const name = ApiKeyNameSchema.parse(rawName);
    return db.$transaction(async (tx): Promise<CreateKeyResult> => {
      // Verrou sur l'entreprise : deux créations simultanées ne dépassent pas le plafond.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT o."id" FROM "Organisation" o JOIN "Membership" m ON m."organisationId" = o."id"
        WHERE o."id" = ${organisationId}::uuid AND m."userId" = ${actor.userId}::uuid AND m."role" IN ('owner', 'admin') FOR UPDATE OF o`;
      if (locked.length === 0) return { kind: "absent" };
      const active = await tx.apiKey.count({ where: { organisationId, revokedAt: null } });
      if (active >= MAX_ACTIVE_KEYS) return { kind: "too_many" };
      const key = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
      const summary = await tx.apiKey.create({
        data: { organisationId, name, prefix: key.slice(0, SHOWN_PREFIX_LENGTH), hash: hashOf(key), createdByUserId: actor.userId, createdAt: now },
        select: SUMMARY,
      });
      return { kind: "created", key, summary };
    });
  },

  /** Les clés de l'entreprise, révoquées comprises, pour ses administrateurs ; `null` pour les autres. */
  async list(actor: Actor, organisationId: string): Promise<readonly ApiKeySummary[] | null> {
    if (!Uuid.safeParse(organisationId).success) return null;
    const admin = await db.organisation.count({ where: { id: organisationId, ...adminOf(actor) } });
    if (admin === 0) return null;
    return db.apiKey.findMany({ where: { organisationId }, orderBy: { createdAt: "desc" }, select: SUMMARY });
  },

  /** Révoque une clé, pour toujours ; `false` si elle n'existe pas, est déjà révoquée ou si l'acteur n'administre pas. */
  async revoke(actor: Actor, organisationId: string, keyId: string, now: Date): Promise<boolean> {
    if (!Uuid.safeParse(organisationId).success || !Uuid.safeParse(keyId).success) return false;
    const { count } = await db.apiKey.updateMany({ where: { id: keyId, organisationId, revokedAt: null, organisation: adminOf(actor) }, data: { revokedAt: now } });
    return count === 1;
  },

  /**
   * L'entreprise derrière une clé, ou `null` si la clé est mal formée, inconnue ou révoquée, ou si plus personne ne
   * répond de l'entreprise (masquée, ou tous ses responsables suspendus).
   */
  async authenticate(key: string, now: Date): Promise<ApiCaller | null> {
    if (!KEY_FORMAT.test(key)) return null;
    const row = await db.apiKey.findFirst({
      where: { hash: hashOf(key), organisation: ANSWERABLE },
      select: { id: true, organisationId: true, revokedAt: true, lastUsedAt: true },
    });
    if (row === null || row.revokedAt !== null) return null;
    if (row.lastUsedAt === null || now.getTime() - row.lastUsedAt.getTime() >= LAST_USED_GRANULARITY_MS) {
      await db.apiKey.updateMany({ where: { id: row.id, revokedAt: null }, data: { lastUsedAt: now } });
    }
    return { keyId: row.id, organisationId: row.organisationId };
  },
});

export type ApiKeys = ReturnType<typeof apiKeys>;
