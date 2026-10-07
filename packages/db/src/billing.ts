import { z } from "zod";
import type { Db } from "./client";
import { containsDirectContact, NO_CONTACT } from "./contact-detection";
import { isUniqueViolation } from "./errors";
import type { Prisma } from "./generated/client";
import type { Actor } from "./messaging";

/*
 * Identités de facturation : celle du freelance (privée, jamais sur un profil public) et celle de l'entreprise. Elles
 * sont recopiées, figées, dans chaque contrat et chaque facture au moment de leur création : modifier son adresse plus
 * tard ne réécrit pas une facture déjà émise, ce que la loi interdit.
 */

const SIRET = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{14}$/, "un SIRET a 14 chiffres"));

/** Numéro de TVA intracommunautaire : deux lettres de pays puis 2 à 13 caractères. */
const VAT = z
  .string()
  .transform((v) => v.replace(/\s/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}[A-Z0-9]{2,13}$/, "numéro de TVA mal formé"));

export const AddressSchema = z.object({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().min(2).max(12),
  city: z.string().trim().min(1).max(120),
  /** Code pays ISO 3166-1 alpha-2. */
  country: z.string().trim().regex(/^[A-Z]{2}$/),
});

export const BillingIdentitySchema = z.object({
  // Le nom légal d'une entreprise devient son nom public sur ses missions. « Booking.com » est une raison sociale.
  legalName: z.string().trim().min(2).max(200).refine((name) => !containsDirectContact(name), { message: NO_CONTACT }),
  siret: SIRET.nullable().default(null),
  vatNumber: VAT.nullable().default(null),
  address: AddressSchema,
  /** 0 en franchise de TVA (art. 293 B du CGI), 2000 au taux normal de 20 %. */
  vatRateBp: z.union([z.literal(0), z.literal(210), z.literal(550), z.literal(1000), z.literal(2000)]).default(0),
  /** Freelance seulement : acceptation expresse du mandat de facturation (Proofseen émet ses factures de mission). */
  acceptInvoicingMandate: z.boolean().default(false),
});

export type BillingIdentityInput = z.input<typeof BillingIdentitySchema>;
export type Address = z.output<typeof AddressSchema>;

/** Ce qui est figé dans un contrat et une facture pour chacune des parties. */
export interface LegalSnapshot {
  readonly legalName: string;
  readonly siret: string | null;
  readonly vatNumber: string | null;
  readonly address: Address;
  /** Taux de TVA facturé par le vendeur ; `null` pour l'acheteur, qui n'en facture pas. */
  readonly vatRateBp: number | null;
}

export const LegalSnapshotSchema = z.object({
  legalName: z.string(),
  siret: z.string().nullable(),
  vatNumber: z.string().nullable(),
  address: AddressSchema,
  vatRateBp: z.number().int().nullable().default(null),
});

export interface Billing {
  /** Enregistre l'identité de facturation du freelance. `false` s'il n'a pas de profil. */
  setFreelanceIdentity(actor: Actor, input: BillingIdentityInput): Promise<SaveIdentityResult>;
  /** Enregistre l'identité légale de l'entreprise. Réservé à ses propriétaires et administrateurs. */
  setOrganisationIdentity(actor: Actor, organisationId: string, input: BillingIdentityInput): Promise<SaveIdentityResult>;
}

/** L'identité figée d'un freelance, ou `null` s'il ne l'a pas encore renseignée. */
export const freelanceSnapshot = async (tx: Prisma.TransactionClient, profileId: string): Promise<LegalSnapshot | null> => {
  const row = await tx.billingIdentity.findUnique({ where: { profileId }, select: { legalName: true, siret: true, vatNumber: true, address: true, vatRateBp: true, invoicingMandateAt: true } });
  if (row === null) return null;
  // Une facture sans SIRET, ou avec de la TVA mais sans numéro de TVA, n'est pas valable : pas de contrat sans eux.
  if (row.siret === null || (row.vatRateBp > 0 && row.vatNumber === null)) return null;
  // Sans mandat de facturation accepté, Proofseen ne peut pas émettre la facture de mission au nom du freelance.
  if (row.invoicingMandateAt === null) return null;
  const address = AddressSchema.safeParse(row.address);
  return address.success ? { legalName: row.legalName, siret: row.siret, vatNumber: row.vatNumber, address: address.data, vatRateBp: row.vatRateBp } : null;
};

/** L'identité figée d'une entreprise, ou `null` si son adresse de facturation manque. */
export const organisationSnapshot = async (tx: Prisma.TransactionClient, organisationId: string): Promise<LegalSnapshot | null> => {
  const row = await tx.organisation.findUnique({ where: { id: organisationId }, select: { name: true, siret: true, vatNumber: true, billingAddress: true } });
  if (row === null) return null;
  const address = AddressSchema.safeParse(row.billingAddress);
  return address.success ? { legalName: row.name, siret: row.siret, vatNumber: row.vatNumber, address: address.data, vatRateBp: null } : null;
};

/** Un SIRET déjà revendiqué par un autre compte : il ne peut appartenir qu'à une seule partie de la plateforme. */
export type SaveIdentityResult = "saved" | "absent" | "siret_taken";

const RESET = { registryStatus: null, registryName: null, registryCheckedAt: null, registryAttemptedAt: null } as const;

export const billing = (db: Db): Billing => ({
  async setFreelanceIdentity(actor, raw) {
    const input = BillingIdentitySchema.parse(raw);
    const profile = await db.freelanceProfile.findUnique({ where: { userId: actor.userId }, select: { id: true } });
    if (profile === null) return "absent";
    const data = { legalName: input.legalName, siret: input.siret, vatNumber: input.vatNumber, address: input.address as Prisma.InputJsonObject, vatRateBp: input.vatRateBp };
    try {
      await db.$transaction(async (tx) => {
        const before = await tx.billingIdentity.findUnique({ where: { profileId: profile.id }, select: { siret: true, legalName: true, invoicingMandateAt: true } });
        // Un SIRET ou une raison sociale changés n'ont plus de verdict : le contrôle au répertoire repart de zéro.
        const recheck = before === null || before.siret !== input.siret || before.legalName !== input.legalName ? RESET : {};
        // Le mandat est daté de sa première acceptation ; l'enregistrer de nouveau ne le rajeunit pas.
        const mandate = input.acceptInvoicingMandate && (before?.invoicingMandateAt ?? null) === null ? { invoicingMandateAt: new Date() } : {};
        await tx.billingIdentity.upsert({ where: { profileId: profile.id }, create: { profileId: profile.id, ...data, ...mandate }, update: { ...data, ...recheck, ...mandate } });
      });
      return "saved";
    } catch (error) {
      if (isUniqueViolation(error)) return "siret_taken";
      throw error;
    }
  },

  async setOrganisationIdentity(actor, organisationId, raw) {
    if (!z.uuid().safeParse(organisationId).success) return "absent";
    const input = BillingIdentitySchema.parse(raw);
    try {
      return await db.$transaction(async (tx) => {
        const before = await tx.organisation.findUnique({ where: { id: organisationId }, select: { siret: true, name: true } });
        const recheck = before === null || before.siret !== input.siret || before.name !== input.legalName ? RESET : {};
        const { count } = await tx.organisation.updateMany({
          where: { id: organisationId, members: { some: { userId: actor.userId, role: { in: ["owner", "admin"] } } } },
          data: { name: input.legalName, siret: input.siret, vatNumber: input.vatNumber, billingAddress: input.address as Prisma.InputJsonObject, ...recheck },
        });
        return count === 1 ? "saved" : "absent";
      });
    } catch (error) {
      if (isUniqueViolation(error)) return "siret_taken";
      throw error;
    }
  },
});
