import { z } from "zod";
import type { Db } from "./client";
import { isUniqueViolation } from "./errors";

/*
 * Demandes d'audit reçues par le formulaire, avant tout compte. C'est la version base de données du dossier
 * `clients/<référence>/` que le web écrivait sur disque.
 *
 * Le dépôt ne tire pas lui-même la référence : il reçoit la fonction qui la tire, celle de `@proofseen/intake`, pour
 * qu'il n'existe qu'une seule définition de son format.
 */

const MAX_REFERENCE_ATTEMPTS = 5;

export const NewAuditRequestSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  urls: z.array(z.url()).min(1).max(10),
  lang: z.enum(["fr", "en"]),
  consentAt: z.date(),
});

export type NewAuditRequest = z.input<typeof NewAuditRequestSchema>;

export interface AuditRequestRecord {
  readonly reference: string;
  readonly displayName: string;
  readonly email: string;
  readonly urls: readonly string[];
  readonly lang: string;
  readonly consentAt: Date;
  readonly createdAt: Date;
}

export interface AuditRequests {
  /** Enregistre une demande et rend sa référence. Une référence déjà prise est retirée, jamais écrasée. */
  open(input: NewAuditRequest, newReference: () => string): Promise<{ readonly reference: string }>;
  /** Toutes les demandes d'une adresse : ce que l'on remet à une personne qui exerce son droit d'accès. */
  findByEmail(email: string): Promise<readonly AuditRequestRecord[]>;
  /** Efface toutes les demandes d'une adresse ; rend le nombre de demandes effacées. */
  eraseByEmail(email: string): Promise<number>;
}

const RECORD = { reference: true, displayName: true, email: true, urls: true, lang: true, consentAt: true, createdAt: true } as const;

export const auditRequests = (db: Db): AuditRequests => ({
  async open(input, newReference) {
    const data = NewAuditRequestSchema.parse(input);
    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
      const reference = newReference();
      try {
        await db.auditRequest.create({ data: { ...data, reference } });
        return { reference };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new Error("impossible d'allouer une référence libre");
  },

  async findByEmail(email) {
    return db.auditRequest.findMany({ where: { email: email.toLowerCase() }, select: RECORD, orderBy: { createdAt: "asc" } });
  },

  async eraseByEmail(email) {
    const { count } = await db.auditRequest.deleteMany({ where: { email: email.toLowerCase() } });
    return count;
  },
});
