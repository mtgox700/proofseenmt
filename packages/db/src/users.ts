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

export interface Users {
  /** L'identifiant interne de la personne, sa ligne créée ou mise à jour depuis Clerk. */
  ensure(identity: ClerkIdentity): Promise<{ readonly userId: string }>;
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
});
