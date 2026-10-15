import { z } from "zod";
import type { Db } from "./client";

/*
 * Le pont entre l'identité Clerk et la base. Clerk authentifie ; la base ne connaît la personne que par son identifiant
 * Clerk, et crée sa ligne à sa première visite connectée. Aucun mot de passe ici, jamais.
 */

export const ClerkIdentitySchema = z.object({
  clerkId: z.string().min(1).max(100),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  displayName: z.string().trim().min(1).max(120),
});

export type ClerkIdentity = z.input<typeof ClerkIdentitySchema>;

/** Les langues des e-mails envoyés à la personne. */
export const USER_LANGS = ["fr", "en"] as const;
export type UserLang = (typeof USER_LANGS)[number];

export interface Users {
  /** L'identifiant interne de la personne, sa ligne créée ou mise à jour depuis Clerk. */
  ensure(identity: ClerkIdentity): Promise<{ readonly userId: string }>;
  /** La langue choisie pour les e-mails ; `fr` par défaut. */
  lang(userId: string): Promise<UserLang>;
  /** Change la langue des e-mails. `false` si la langue n'est pas proposée ou si la personne n'existe pas. */
  setLang(userId: string, lang: string): Promise<boolean>;
}

export const users = (db: Db): Users => ({
  async ensure(identity) {
    const { clerkId, email, displayName } = ClerkIdentitySchema.parse(identity);
    // Une seule instruction : deux onglets ouverts en même temps ne créent pas deux lignes.
    const { id } = await db.user.upsert({
      where: { clerkId },
      create: { clerkId, email, displayName },
      update: { email, displayName },
      select: { id: true },
    });
    return { userId: id };
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
});
