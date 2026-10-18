import { z } from "zod";
import type { Db } from "./client";
import { FRESH_ACCOUNT_MS, tombstoneCutoff, tombstoneHash } from "./erasure-tombstones";
import type { Actor } from "./messaging";

/*
 * Le pont entre l'identité Clerk et la base. Clerk authentifie ; la base ne connaît la personne que par son identifiant
 * Clerk, et crée sa ligne à sa première visite connectée. Aucun mot de passe ici, jamais.
 */

export const ClerkIdentitySchema = z.object({
  clerkId: z.string().min(1).max(100),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  displayName: z.string().trim().min(1).max(120),
  /** Vrai seulement quand Clerk certifie l'adresse (code reçu) : c'est la condition pour rattacher une ligne existante. */
  emailVerified: z.boolean().default(false),
});

export type ClerkIdentity = z.input<typeof ClerkIdentitySchema>;

/** Les langues des e-mails envoyés à la personne. */
export const USER_LANGS = ["fr", "en"] as const;
export type UserLang = (typeof USER_LANGS)[number];
/** Au-delà, un compte n'est plus « neuf » : il puise dans toute la réserve des services payants (import de CV). */
export const ESTABLISHED_ACCOUNT_DAYS = 7;
const DAY_MS = 86_400_000;
const Uuid = z.uuid();

export interface EnsuredUser {
  readonly userId: string;
  /** Suspension posée par un opérateur (C19) : la personne n'a plus accès aux espaces de l'application. */
  readonly suspension: { readonly at: Date; readonly reason: string } | null;
}

export interface Users {
  /** L'identifiant interne de la personne, sa ligne créée ou mise à jour depuis Clerk, et sa suspension éventuelle. */
  ensure(identity: ClerkIdentity): Promise<EnsuredUser>;
  /** La langue choisie pour les e-mails ; `fr` par défaut. */
  lang(userId: string): Promise<UserLang>;
  /** Change la langue des e-mails. `false` si la langue n'est pas proposée ou si la personne n'existe pas. */
  setLang(userId: string, lang: string): Promise<boolean>;
  /**
   * Vrai pour un compte établi : profil publié, ou compte créé depuis plus de ESTABLISHED_ACCOUNT_DAYS jours. Un compte
   * jetable, créé pour vider une réserve partagée, ne l'est pas.
   */
  isEstablished(actor: Actor, now: Date): Promise<boolean>;
  /** La ligne d'un identifiant Clerk, sans jamais la créer : l'effacement retrouve ainsi une ligne recréée entre-temps. */
  idOfSignIn(clerkId: string): Promise<string | null>;
}

export interface UsersOptions {
  /**
   * Clé des traces d'effacement (`erasure-tombstones.ts`), dérivée du secret du serveur. Sans elle, une réinscription
   * n'est pas comparée aux comptes suspendus effacés.
   */
  readonly tombstoneKey?: string | null;
}

/**
 * Un compte tout neuf dont l'adresse a laissé une trace de suspension : la suspension est reposée, et la trace part
 * (revue de sécurité vague 3, L11). `null` s'il n'y a rien à reposer.
 */
const reapplySuspension = async (db: Db, userId: string, email: string, key: string): Promise<EnsuredUser["suspension"]> =>
  db.$transaction(async (tx) => {
    const emailHash = tombstoneHash(email, key);
    const stone = await tx.erasureTombstone.findUnique({ where: { emailHash }, select: { suspendedAt: true, suspensionReason: true, createdAt: true } });
    if (stone === null || stone.createdAt < tombstoneCutoff(new Date())) return null;
    await tx.erasureTombstone.deleteMany({ where: { emailHash } });
    await tx.user.updateMany({ where: { id: userId, suspendedAt: null }, data: { suspendedAt: stone.suspendedAt, suspensionReason: stone.suspensionReason } });
    return { at: stone.suspendedAt, reason: stone.suspensionReason };
  });

export const users = (db: Db, options: UsersOptions = {}): Users => ({
  async ensure(identity) {
    const { clerkId, email, displayName, emailVerified } = ClerkIdentitySchema.parse(identity);
    // Changement d'instance Clerk (développement → production, 2026-10-18) : la même personne revient avec un autre
    // identifiant. Sa ligne est retrouvée par son adresse, seulement si Clerk la certifie : ajouter l'adresse d'un autre
    // sans la confirmer ne rattache rien, et la contrainte d'unicité refuse alors la création.
    if (emailVerified) {
      const known = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
      if (known === null) await db.user.updateMany({ where: { email, NOT: { clerkId } }, data: { clerkId } });
    }
    // Une seule instruction : deux onglets ouverts en même temps ne créent pas deux lignes.
    const { id, suspendedAt, suspensionReason, createdAt } = await db.user.upsert({
      where: { clerkId },
      create: { clerkId, email, displayName },
      update: { email, displayName },
      select: { id: true, suspendedAt: true, suspensionReason: true, createdAt: true },
    });
    if (suspendedAt !== null && suspensionReason !== null) return { userId: id, suspension: { at: suspendedAt, reason: suspensionReason } };
    // Seul un compte de moins d'un jour est comparé aux traces : le coût d'une requête ne pèse pas sur tous les passages.
    const key = options.tombstoneKey ?? null;
    if (key === null || key === "" || Date.now() - createdAt.getTime() > FRESH_ACCOUNT_MS) return { userId: id, suspension: null };
    return { userId: id, suspension: await reapplySuspension(db, id, email, key) };
  },

  async lang(userId) {
    if (!z.uuid().safeParse(userId).success) return "fr";
    const row = await db.user.findUnique({ where: { id: userId }, select: { lang: true } });
    return row?.lang === "en" ? "en" : "fr";
  },

  async setLang(userId, lang) {
    const parsed = z.enum(USER_LANGS).safeParse(lang);
    if (!parsed.success || !z.uuid().safeParse(userId).success) return false;
    const { count } = await db.user.updateMany({ where: { id: userId }, data: { lang: parsed.data } });
    return count === 1;
  },

  async isEstablished(actor, now) {
    if (!Uuid.safeParse(actor.userId).success) return false;
    const row = await db.user.findUnique({ where: { id: actor.userId }, select: { createdAt: true, freelanceProfile: { select: { visibility: true, slug: true } } } });
    if (row === null) return false;
    const published = row.freelanceProfile !== null && row.freelanceProfile.visibility !== "private" && row.freelanceProfile.slug !== null;
    return published || row.createdAt.getTime() + ESTABLISHED_ACCOUNT_DAYS * DAY_MS <= now.getTime();
  },

  async idOfSignIn(clerkId) {
    if (!ClerkIdentitySchema.shape.clerkId.safeParse(clerkId).success) return null;
    return (await db.user.findUnique({ where: { clerkId }, select: { id: true } }))?.id ?? null;
  },
});
